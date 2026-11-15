# -*- coding: utf-8 -*-
"""
mlflow_experiments.py — MLflow Experiment Tracking for BankShield Fraud Detection
===================================================================================

Runs multiple XGBoost training experiments with different hyperparameters,
tracks everything in MLflow, compares results, and deploys the best model.

Usage:
    cd ml-service
    .\\venv\\Scripts\\activate
    python notebooks/mlflow_experiments.py

After running:
    - View MLflow UI:  mlflow ui --backend-store-uri file:./mlruns  --port 5001
    - Open http://localhost:5001 in browser
    - Best model auto-copied to saved_models/xgboost_fraud_model.joblib
"""

import os
import sys
import json
import shutil
import time
import warnings
from pathlib import Path
from itertools import product

import numpy as np
import joblib
import mlflow
import mlflow.xgboost
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import (
    confusion_matrix, classification_report,
    roc_auc_score, average_precision_score,
    precision_recall_curve, roc_curve,
    f1_score, precision_score, recall_score,
)

# Import from train.py
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from train import (
    FEATURE_NAMES, generate_dataset, compute_metrics,
    find_optimal_threshold, print_feature_importance,
)

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────
ML_SERVICE_DIR = SCRIPT_DIR.parent
TRAINED_DIR    = ML_SERVICE_DIR / "trained_models"
SAVED_DIR      = ML_SERVICE_DIR / "saved_models"
MLRUNS_DIR     = ML_SERVICE_DIR / "mlruns"

TRAINED_DIR.mkdir(exist_ok=True)
SAVED_DIR.mkdir(exist_ok=True)
MLRUNS_DIR.mkdir(exist_ok=True)

# ── MLflow Setup ──────────────────────────────────────────────────────────────
MLFLOW_DB = ML_SERVICE_DIR / "mlflow.db"
mlflow.set_tracking_uri(f"sqlite:///{MLFLOW_DB}")
mlflow.set_experiment("BankShield_Fraud_Detection")
mlflow.set_experiment_tag("project", "BankShield")
mlflow.set_experiment_tag("task", "fraud_detection")
mlflow.set_experiment_tag("model", "XGBoost")


# ── Experiment Configurations ─────────────────────────────────────────────────
EXPERIMENTS = [
    # ── Baseline: current production model ──────────────────────────────────
    {
        "name": "baseline_f2_21feat",
        "n_samples": 100_000,
        "fraud_rate": 0.025,
        "threshold_strategy": "f2",
        "params": dict(
            n_estimators=400, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
            gamma=0.1, reg_alpha=0.1, reg_lambda=1.5,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=30, random_state=42, n_jobs=-1,
        ),
    },
    # ── Experiment 1: Shallow trees, lower LR (prevent overfit) ───────────────
    {
        "name": "shallow_trees",
        "n_samples": 100_000,
        "fraud_rate": 0.025,
        "threshold_strategy": "f2",
        "params": dict(
            n_estimators=600, max_depth=4, learning_rate=0.03,
            subsample=0.85, colsample_bytree=0.85, min_child_weight=10,
            gamma=0.2, reg_alpha=0.2, reg_lambda=2.0,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=50, random_state=42, n_jobs=-1,
        ),
    },
    # ── Experiment 2: Deep trees, higher LR (faster convergence) ──────────────
    {
        "name": "deep_trees_fast_lr",
        "n_samples": 100_000,
        "fraud_rate": 0.025,
        "threshold_strategy": "f2",
        "params": dict(
            n_estimators=300, max_depth=8, learning_rate=0.1,
            subsample=0.75, colsample_bytree=0.75, min_child_weight=3,
            gamma=0.05, reg_alpha=0.05, reg_lambda=1.0,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=25, random_state=42, n_jobs=-1,
        ),
    },
    # ── Experiment 3: Higher fraud rate in training (more positive signal) ───
    {
        "name": "high_fraud_rate_5pct",
        "n_samples": 100_000,
        "fraud_rate": 0.05,
        "threshold_strategy": "f2",
        "params": dict(
            n_estimators=400, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
            gamma=0.1, reg_alpha=0.1, reg_lambda=1.5,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=30, random_state=42, n_jobs=-1,
        ),
    },
    # ── Experiment 4: Youden threshold (balanced sensitivity/specificity) ──────
    {
        "name": "youden_threshold",
        "n_samples": 100_000,
        "fraud_rate": 0.025,
        "threshold_strategy": "youden",
        "params": dict(
            n_estimators=400, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
            gamma=0.1, reg_alpha=0.1, reg_lambda=1.5,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=30, random_state=42, n_jobs=-1,
        ),
    },
    # ── Experiment 5: More data, aggressive regularization ────────────────────
    {
        "name": "big_data_reg",
        "n_samples": 200_000,
        "fraud_rate": 0.025,
        "threshold_strategy": "f2",
        "params": dict(
            n_estimators=500, max_depth=5, learning_rate=0.04,
            subsample=0.7, colsample_bytree=0.7, min_child_weight=15,
            gamma=0.3, reg_alpha=0.5, reg_lambda=3.0,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=40, random_state=42, n_jobs=-1,
        ),
    },
    # ── Experiment 6: Precision-focused (minimize false positives) ────────────
    {
        "name": "precision_focused",
        "n_samples": 100_000,
        "fraud_rate": 0.025,
        "threshold_strategy": "f1",
        "params": dict(
            n_estimators=500, max_depth=7, learning_rate=0.06,
            subsample=0.9, colsample_bytree=0.9, min_child_weight=8,
            gamma=0.15, reg_alpha=0.3, reg_lambda=2.0,
            tree_method="hist", eval_metric="aucpr",
            early_stopping_rounds=35, random_state=42, n_jobs=-1,
        ),
    },
]


# ── Single Experiment Runner ─────────────────────────────────────────────────
def run_experiment(exp_cfg, run_idx, total):
    """Run one experiment and log everything to MLflow."""
    name = exp_cfg["name"]
    n_samples = exp_cfg["n_samples"]
    fraud_rate = exp_cfg["fraud_rate"]
    strategy = exp_cfg["threshold_strategy"]
    params = exp_cfg["params"]

    print(f"\n{'='*70}")
    print(f"  Experiment {run_idx}/{total}: {name}")
    print(f"  samples={n_samples:,}  fraud_rate={fraud_rate}  threshold={strategy}")
    print(f"{'='*70}")

    t0 = time.time()

    with mlflow.start_run(run_name=name) as run:
        run_id = run.info.run_id

        # ── Log tags ────────────────────────────────────────────────────────
        mlflow.set_tag("experiment_name", name)
        mlflow.set_tag("n_samples", str(n_samples))
        mlflow.set_tag("fraud_rate", str(fraud_rate))
        mlflow.set_tag("threshold_strategy", strategy)
        mlflow.set_tag("feature_count", str(len(FEATURE_NAMES)))

        # ── Log all hyperparameters ─────────────────────────────────────────
        mlflow.log_params(params)
        mlflow.log_param("n_samples", n_samples)
        mlflow.log_param("fraud_rate", fraud_rate)
        mlflow.log_param("threshold_strategy", strategy)
        mlflow.log_param("n_features", len(FEATURE_NAMES))
        mlflow.log_param("feature_names", ",".join(FEATURE_NAMES))

        # ── Generate dataset ────────────────────────────────────────────────
        print("  [1/6] Generating dataset...")
        df = generate_dataset(n_samples=n_samples, fraud_rate=fraud_rate)
        X = df[FEATURE_NAMES].values.astype(np.float32)
        y = df["label"].values
        mlflow.log_param("actual_fraud_rate", round(float(y.mean()), 5))

        # ── Split ───────────────────────────────────────────────────────────
        X_trainval, X_test, y_trainval, y_test = train_test_split(
            X, y, test_size=0.15, stratify=y, random_state=42
        )
        X_train, X_val, y_train, y_val = train_test_split(
            X_trainval, y_trainval, test_size=0.1765, stratify=y_trainval, random_state=42
        )

        fraud_train = y_train.sum()
        legit_train = (y_train == 0).sum()
        spw = legit_train / max(fraud_train, 1)

        mlflow.log_param("train_size", len(y_train))
        mlflow.log_param("val_size", len(y_val))
        mlflow.log_param("test_size", len(y_test))
        mlflow.log_param("scale_pos_weight", round(spw, 2))

        # ── Train model ─────────────────────────────────────────────────────
        print("  [2/6] Training XGBoost...")
        model_params = {**params, "scale_pos_weight": spw}
        model = XGBClassifier(**model_params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
        best_iter = model.best_iteration
        mlflow.log_metric("best_iteration", best_iter or 0)

        # ── Find optimal threshold ──────────────────────────────────────────
        print("  [3/6] Finding optimal threshold...")
        val_prob = model.predict_proba(X_val)[:, 1]
        threshold = find_optimal_threshold(y_val, val_prob, strategy=strategy)
        mlflow.log_param("optimal_threshold", round(threshold, 4))

        # ── Compute metrics ─────────────────────────────────────────────────
        print("  [4/6] Computing metrics...")
        train_prob = model.predict_proba(X_train)[:, 1]
        test_prob  = model.predict_proba(X_test)[:, 1]

        train_m = compute_metrics(y_train, train_prob, threshold, "train")
        val_m   = compute_metrics(y_val,   val_prob,   threshold, "val")
        test_m  = compute_metrics(y_test,  test_prob,  threshold, "test")

        # Log all metrics to MLflow (prefixed by split)
        for split_name, m in [("train", train_m), ("val", val_m), ("test", test_m)]:
            for k, v in m.items():
                if k not in ("split", "threshold"):
                    mlflow.log_metric(f"{split_name}_{k}", float(v) if v is not None else 0)

        # ── Feature importance ──────────────────────────────────────────────
        print("  [5/6] Computing feature importance...")
        importance = dict(zip(
            FEATURE_NAMES,
            model.feature_importances_.tolist()
        ))
        # Log top features as metrics
        for feat, imp in sorted(importance.items(), key=lambda x: -x[1])[:5]:
            mlflow.log_metric(f"importance_{feat}", imp)

        print(f"\n  {'Metric':<20} {'Train':>10} {'Val':>10} {'Test':>10}")
        print(f"  {'─'*52}")
        for k in ["roc_auc", "pr_auc", "f1", "precision", "recall", "false_alarm_rate"]:
            print(f"  {k:<20} {train_m[k]:>10} {val_m[k]:>10} {test_m[k]:>10}")

        # ── Log model artifact ──────────────────────────────────────────────
        print("  [6/6] Logging artifacts to MLflow...")
        model_path = TRAINED_DIR / f"exp_{name}_model.joblib"
        joblib.dump(model, model_path, compress=3)
        mlflow.log_artifact(str(model_path), artifact_path="model")
        mlflow.xgboost.log_model(model, artifact_path="xgboost_model")

        # Log threshold and feature names
        thresh_path = TRAINED_DIR / f"exp_{name}_threshold.json"
        with open(thresh_path, "w") as f:
            json.dump({"threshold": threshold, "strategy": strategy}, f, indent=2)
        mlflow.log_artifact(str(thresh_path), artifact_path="config")

        # Clean up temp files
        model_path.unlink(missing_ok=True)
        thresh_path.unlink(missing_ok=True)

        elapsed = time.time() - t0
        mlflow.log_metric("training_time_s", round(elapsed, 1))

        print(f"\n  Done in {elapsed:.1f}s")
        print(f"  MLflow run_id: {run_id}")
        print(f"  Test ROC-AUC={test_m['roc_auc']}  PR-AUC={test_m['pr_auc']}  "
              f"F1={test_m['f1']}  Recall={test_m['recall']}  Precision={test_m['precision']}")

        return {
            "name": name,
            "run_id": run_id,
            "threshold": threshold,
            "test_roc_auc": test_m["roc_auc"],
            "test_pr_auc": test_m["pr_auc"],
            "test_f1": test_m["f1"],
            "test_precision": test_m["precision"],
            "test_recall": test_m["recall"],
            "test_fp": test_m["fp"],
            "test_fn": test_m["fn"],
            "training_time_s": round(elapsed, 1),
            "model": model,
            "importance": importance,
        }


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("  BankShield — MLflow Experiment Tracking")
    print("  Tracking URI: file:" + str(MLRUNS_DIR))
    print("  Experiments:  " + str(len(EXPERIMENTS)))
    print("=" * 70)

    results = []
    total = len(EXPERIMENTS)

    for i, exp in enumerate(EXPERIMENTS, 1):
        result = run_experiment(exp, i, total)
        results.append(result)

    # ── Comparison Table ─────────────────────────────────────────────────────
    print("\n" + "=" * 100)
    print("  EXPERIMENT COMPARISON (sorted by test F1)")
    print("=" * 100)
    print(f"  {'#':<4} {'Experiment':<25} {'ROC-AUC':>8} {'PR-AUC':>8} {'F1':>6} "
          f"{'Prec':>6} {'Recall':>7} {'FN':>4} {'FP':>4} {'Time':>6}  Threshold")
    print(f"  {'─'*96}")

    # Sort by test F1 score (primary metric for fraud detection)
    results.sort(key=lambda r: r["test_f1"], reverse=True)

    for i, r in enumerate(results, 1):
        marker = " <-- BEST" if i == 1 else ""
        print(f"  {i:<4} {r['name']:<25} {r['test_roc_auc']:>8.4f} {r['test_pr_auc']:>8.4f} "
              f"{r['test_f1']:>6.4f} {r['test_precision']:>6.4f} {r['test_recall']:>7.4f} "
              f"{r['test_fn']:>4} {r['test_fp']:>4} {r['training_time_s']:>5.1f}s  "
              f"{r['threshold']:.4f}{marker}")

    # ── Deploy Best Model ────────────────────────────────────────────────────
    best = results[0]
    print(f"\n{'='*70}")
    print(f"  BEST MODEL: {best['name']}")
    print(f"  Test F1={best['test_f1']}  Recall={best['test_recall']}  "
          f"Precision={best['test_precision']}")
    print(f"  ROC-AUC={best['test_roc_auc']}  PR-AUC={best['test_pr_auc']}")
    print(f"  Threshold={best['threshold']:.4f}  (strategy: {EXPERIMENTS[0]['threshold_strategy']})")
    print(f"{'='*70}")

    # Save best model to deployment paths
    deploy_model_path = SAVED_DIR / "xgboost_fraud_model.joblib"
    deploy_thresh_path = TRAINED_DIR / "threshold.json"
    deploy_metrics_path = TRAINED_DIR / "training_metrics.json"
    deploy_feat_path = TRAINED_DIR / "feature_names.json"

    joblib.dump(best["model"], deploy_model_path, compress=3)
    with open(deploy_thresh_path, "w") as f:
        json.dump({"threshold": best["threshold"], "strategy": "f2"}, f, indent=2)
    with open(deploy_feat_path, "w") as f:
        json.dump(FEATURE_NAMES, f, indent=2)
    with open(deploy_metrics_path, "w") as f:
        json.dump({
            "best_experiment": best["name"],
            "best_run_id": best["run_id"],
            "threshold": best["threshold"],
            "test": {
                "roc_auc": best["test_roc_auc"],
                "pr_auc": best["test_pr_auc"],
                "f1": best["test_f1"],
                "precision": best["test_precision"],
                "recall": best["test_recall"],
                "fn": best["test_fn"],
                "fp": best["test_fp"],
            },
            "feature_importance": best["importance"],
            "all_experiments": [
                {k: v for k, v in r.items() if k not in ("model", "importance")}
                for r in results
            ],
        }, f, indent=2, default=str)

    print(f"\n  Deployed model -> {deploy_model_path}")
    print(f"  Threshold      -> {deploy_thresh_path}")
    print(f"  Metrics        -> {deploy_metrics_path}")

    # ── Top Features ─────────────────────────────────────────────────────────
    print(f"\n  Top 5 Features (gain importance):")
    for feat, imp in sorted(best["importance"].items(), key=lambda x: -x[1])[:5]:
        bar = "#" * int(imp / max(best["importance"].values()) * 30)
        print(f"    {feat:<28} {imp:.4f}  {bar}")

    # ── MLflow UI Instructions ────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print(f"  MLflow Tracking UI")
    print(f"{'='*70}")
    print(f"  Run:  mlflow ui --backend-store-uri sqlite:///{MLFLOW_DB} --port 5001")
    print(f"  Open: http://localhost:5001")
    print(f"  Experiment: BankShield_Fraud_Detection")
    print(f"  Total runs: {len(results)}")
    print(f"  Best run:   {best['run_id']}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
