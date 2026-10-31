/**
 * CustomerDashboard.jsx — Customer self-service dashboard.
 * Shows onboarding panel when no accounts exist; live data otherwise.
 * No hardcoded data.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  CreditCard, TrendingUp, AlertTriangle, ShieldCheck,
  ArrowLeftRight, RefreshCw, Building2, Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusBadge }   from '@/components/ui/StatusBadge';
import { RiskBadge }     from '@/components/fraud/RiskBadge';
import { InlineLoader }  from '@/components/ui/LoadingOverlay';
import { ErrorMessage }  from '@/components/ui/ErrorMessage';
import { Button }        from '@/components/ui/button';
import { accountService }     from '@/services/accountService';
import { transactionService } from '@/services/transactionService';
import { fraudService }       from '@/services/fraudService';
import { dashboardService }   from '@/services/dashboardService';

const fmtAmt = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(n ?? 0);

const fmtDate = (s) => s
  ? new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

export default function CustomerDashboard() {
  const { user } = useAuth();

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [accounts, setAccounts]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [alertCnt, setAlertCnt]     = useState(0);
  const [summary, setSummary]       = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [accRes, txnRes, alertRes, summaryRes] = await Promise.allSettled([
      accountService.list({ limit: 10 }),
      transactionService.list({ limit: 5, sortDir: 'DESC' }),
      fraudService.listAlerts({ status: 'open', limit: 1 }),
      dashboardService.getSummary(),
    ]);

    let anyFulfilled = false;

    // Accounts
    if (accRes.status === 'fulfilled') {
      anyFulfilled = true;
      const raw = accRes.value?.data;
      if (Array.isArray(raw)) {
        setAccounts(raw);
      } else if (Array.isArray(raw?.accounts)) {
        setAccounts(raw.accounts);
      } else {
        setAccounts([]);
      }
    }

    // Transactions
    if (txnRes.status === 'fulfilled') {
      anyFulfilled = true;
      const raw = txnRes.value?.data;
      if (Array.isArray(raw)) {
        setTransactions(raw);
      } else if (Array.isArray(raw?.transactions)) {
        setTransactions(raw.transactions);
      } else {
        setTransactions([]);
      }
    }

    // Alerts
    if (alertRes.status === 'fulfilled') {
      anyFulfilled = true;
      const raw = alertRes.value?.data;
      if (Array.isArray(raw)) {
        setAlertCnt(raw.length);
      } else if (Array.isArray(raw?.alerts)) {
        setAlertCnt(raw.alerts.length);
      } else if (typeof raw?.total === 'number') {
        setAlertCnt(raw.total);
      } else {
        setAlertCnt(0);
      }
    }

    // Summary
    if (summaryRes.status === 'fulfilled') {
      anyFulfilled = true;
      setSummary(summaryRes.value);
    }

    // Only show error if every single call failed
    if (!anyFulfilled) {
      setError('Unable to load dashboard data. Please try again.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <InlineLoader />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
        <ErrorMessage message={error} />
        <div className="mt-4">
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Empty / Onboarding state ─────────────────────────────────────────────────
  if (accounts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome to BankShield
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Your accounts will appear here once a branch manager opens them for you.
          </p>

          {/* Step cards */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Card className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-blue-500" />
                  <CardTitle className="text-base text-slate-800 dark:text-slate-100">
                    Visit Your Branch
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Visit any BankShield branch with your ID and address proof to open an account.
                </p>
              </CardContent>
            </Card>

            <Card className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-purple-500" />
                  <CardTitle className="text-base text-slate-800 dark:text-slate-100">
                    Choose Account Type
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select from savings, current, or fixed deposit accounts based on your needs.
                </p>
              </CardContent>
            </Card>

            <Card className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                  <CardTitle className="text-base text-slate-800 dark:text-slate-100">
                    Start Banking
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Once your account is opened, log back in to see your dashboard, make transfers, and more.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Info banner */}
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">
              Already visited a branch? Your account may still be processing.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loaded state ─────────────────────────────────────────────────────────────
  const totalBalance    = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const activeCount     = accounts.filter(a => a.status === 'active').length;
  const txnCount        = summary?.data?.totalTransactions ?? transactions.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              My Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Fraud alert banner */}
        {alertCnt > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">
              You have {alertCnt} open security alert{alertCnt > 1 ? 's' : ''} requiring attention.
            </span>
            <Link
              to="/fraud/alerts"
              className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
            >
              View Alerts
            </Link>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Total Balance
                </span>
                <CreditCard className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {fmtAmt(totalBalance)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Active Accounts
                </span>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {activeCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Transactions (30d)
                </span>
                <ArrowLeftRight className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {txnCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Security Alerts
                </span>
                {alertCnt > 0
                  ? <AlertTriangle className="w-4 h-4 text-red-500" />
                  : <ShieldCheck   className="w-4 h-4 text-green-500" />
                }
              </div>
              <p className={`text-2xl font-bold ${alertCnt > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {alertCnt}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/transfer">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Transfer Funds
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/accounts">
              <CreditCard className="w-4 h-4 mr-2" />
              My Accounts
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/fraud/alerts">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Security Alerts
            </Link>
          </Button>
        </div>

        {/* Recent Transactions */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-base text-slate-800 dark:text-slate-100">
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 px-6 py-4">
                No recent transactions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Date</th>
                      <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Reference</th>
                      <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Type</th>
                      <th className="text-right px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                      <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr
                        key={txn.id}
                        className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {fmtDate(txn.createdAt ?? txn.created_at)}
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                          {txn.transactionRef ?? txn.transaction_ref ?? txn.id?.slice(0, 8)}
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 capitalize">
                          {txn.transactionType ?? txn.transaction_type ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {fmtAmt(txn.amount)}
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge status={txn.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts Summary */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-base text-slate-800 dark:text-slate-100">
              Accounts Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Account Number</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Type</th>
                    <th className="text-right px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Balance</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr
                      key={acc.id}
                      className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {acc.accountNumber ?? acc.account_number ?? acc.id?.slice(0, 12)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300 capitalize">
                        {acc.accountType ?? acc.account_type ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {fmtAmt(acc.balance)}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={acc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
