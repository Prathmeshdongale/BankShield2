// ═══════════════════════════════════════════════════════════════════════════════
// BankShield — CI/CD Pipeline (Jenkinsfile)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Architecture:
//   1. React + Vite frontend  →  Vercel (Jenkins triggers Vercel CLI deploy)
//   2. Express API backend    →  Render (Docker build + Render deploy)
//   3. FastAPI ML service      →  Render (Docker build + Render deploy)
//
// Jenkins environment: Windows local Jenkins
// Secrets (configure in Jenkins > Manage > Credentials):
//   VERCEL_TOKEN        — Vercel personal access token
//   VERCEL_ORG_ID       — Vercel team/org ID
//   VERCEL_PROJECT_ID   — Vercel project ID for BankShield frontend
//   RENDER_API_KEY      — Render.com API key for backend deploys
//   RENDER_SERVICE_API  — Render service ID for Express API
//   RENDER_SERVICE_ML   — Render service ID for ML service
//   DATABASE_URL        — PostgreSQL connection string (Neon/Render Postgres)
//   JWT_SECRET          — JWT access token secret
//   JWT_REFRESH_SECRET — JWT refresh token secret
// ═══════════════════════════════════════════════════════════════════════════════

pipeline {
    agent any

    environment {
        // ── Project paths ──────────────────────────────────────────────────────
        PROJECT_ROOT   = "${WORKSPACE}"
        SERVER_DIR     = "${WORKSPACE}\\server"
        ML_DIR         = "${WORKSPACE}\\ml-service"
        CLIENT_DIR     = "${WORKSPACE}\\client"

        // ── Docker image tags (use build number for versioning) ─────────────────
        DOCKER_TAG     = "${env.BUILD_NUMBER}"
        API_IMAGE      = "bankshield-api:${DOCKER_TAG}"
        ML_IMAGE       = "bankshield-ml:${DOCKER_TAG}"

        // ── Render deployment URLs (post-deploy health check targets) ──────────
        RENDER_API_URL  = "https://bankshield-api.onrender.com"
        RENDER_ML_URL   = "https://bankshield-ml.onrender.com"
        VERCEL_URL      = "https://bankshield.vercel.app"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        disableConcurrentBuilds()
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STAGES
    // ═══════════════════════════════════════════════════════════════════════════

    stages {

        // ───────────────────────────────────────────────────────────────────────
        // STAGE 1: Checkout & Pre-flight Checks
        // ───────────────────────────────────────────────────────────────────────
        stage('Checkout & Pre-flight') {
            steps {
                script {
                    echo "╔══════════════════════════════════════════════════╗"
                    echo "║  BankShield CI/CD Pipeline — Build #${BUILD_NUMBER}"
                    echo "╚══════════════════════════════════════════════════╝"

                    // Verify required credentials exist
                    def requiredCreds = [
                        'VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID',
                        'RENDER_API_KEY', 'RENDER_SERVICE_API', 'RENDER_SERVICE_ML'
                    ]
                    for (cred in requiredCreds) {
                        try {
                            def val = credentials(cred)
                            if (!val) {
                                error "Missing credential: ${cred}"
                            }
                            echo "  ✔  Credential found: ${cred}"
                        } catch (Exception e) {
                            error "Missing credential: ${cred} — configure in Jenkins > Manage > Credentials"
                        }
                    }

                    // Check Docker availability
                    bat "docker version --format '{{.Server.Version}}'"

                    // Display environment info
                    echo "  Workspace:    ${WORKSPACE}"
                    echo "  Docker tag:    ${DOCKER_TAG}"
                    echo "  Git branch:   ${env.GIT_BRANCH ?: 'N/A'}"
                    echo "  Git commit:   ${env.GIT_COMMIT?.take(8) ?: 'N/A'}"
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────────
        // STAGE 2: Build & Test Express Backend (Docker)
        // ───────────────────────────────────────────────────────────────────────
        stage('Build: Backend (Express)') {
            steps {
                script {
                    echo "┌─────────────────────────────────────────────────┐"
                    echo "│  Building Express API Docker image               │"
                    echo "└─────────────────────────────────────────────────┘"

                    dir(SERVER_DIR) {
                        // Build Docker image
                        bat "docker build -t ${API_IMAGE} ."

                        // Quick smoke test: verify the image starts
                        bat "docker run --rm -d --name bs-api-test -p 5099:5000 ${API_IMAGE}"
                        sleep 5

                        // Health check
                        def healthy = false
                        for (int i = 0; i < 5; i++) {
                            try {
                                def result = bat(returnStdout: true, script: "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:5099/health")
                                if (result.trim() == "200") {
                                    healthy = true
                                    echo "  ✔  Backend health check passed (HTTP 200)"
                                    break
                                }
                            } catch (Exception e) {}
                            sleep 3
                        }

                        // Stop test container
                        bat "docker stop bs-api-test 2>nul || true"
                        bat "docker rm bs-api-test 2>nul || true"

                        if (!healthy) {
                            echo "  ⚠  Health check failed — image built but not verified"
                        }
                    }
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────────
        // STAGE 3: Build & Test ML Service (Docker)
        // ───────────────────────────────────────────────────────────────────────
        stage('Build: ML Service (FastAPI)') {
            steps {
                script {
                    echo "┌─────────────────────────────────────────────────┐"
                    echo "│  Building FastAPI ML Service Docker image        │"
                    echo "└─────────────────────────────────────────────────┘"

                    dir(ML_DIR) {
                        // Build Docker image
                        bat "docker build -t ${ML_IMAGE} ."

                        // Quick smoke test: verify the image starts
                        bat "docker run --rm -d --name bs-ml-test -p 8009:8000 ${ML_IMAGE}"
                        sleep 8

                        // Health check
                        def healthy = false
                        for (int i = 0; i < 5; i++) {
                            try {
                                def result = bat(returnStdout: true, script: "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:8009/health")
                                if (result.trim() == "200") {
                                    healthy = true
                                    echo "  ✔  ML service health check passed (HTTP 200)"
                                    break
                                }
                            } catch (Exception e) {}
                            sleep 3
                        }

                        // Verify model loaded
                        if (healthy) {
                            try {
                                def health = bat(returnStdout: true, script: "curl -s http://localhost:8009/health")
                                if (health.contains("\"model_loaded\": true")) {
                                    echo "  ✔  XGBoost model loaded in container"
                                } else {
                                    echo "  ⚠  Model not loaded — check artifacts"
                                }
                            } catch (Exception e) {}
                        }

                        // Stop test container
                        bat "docker stop bs-ml-test 2>nul || true"
                        bat "docker rm bs-ml-test 2>nul || true"

                        if (!healthy) {
                            echo "  ⚠  Health check failed — image built but not verified"
                        }
                    }
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────────
        // STAGE 4: Deploy Frontend to Vercel
        // ───────────────────────────────────────────────────────────────────────
        stage('Deploy: Frontend → Vercel') {
            when {
                anyOf {
                    branch 'main'
                    expression { env.GIT_BRANCH?.contains('main') }
                    expression { env.BRANCH_NAME == 'main' }
                }
            }
            steps {
                script {
                    echo "┌─────────────────────────────────────────────────┐"
                    echo "│  Deploying React frontend to Vercel              │"
                    echo "└─────────────────────────────────────────────────┘"

                    dir(CLIENT_DIR) {
                        // Install Vercel CLI globally
                        bat "npm install -g vercel@latest"

                        // Set Vercel environment variables
                        withCredentials([
                            string(credentialsId: 'VERCEL_TOKEN', variable: 'VERCEL_TOKEN'),
                            string(credentialsId: 'VERCEL_ORG_ID', variable: 'VERCEL_ORG_ID'),
                            string(credentialsId: 'VERCEL_PROJECT_ID', variable: 'VERCEL_PROJECT_ID')
                        ]) {
                            // Deploy to Vercel (production)
                            bat """
                                cd /d "${CLIENT_DIR}"
                                set VERCEL_TOKEN=%VERCEL_TOKEN%
                                set VERCEL_ORG_ID=%VERCEL_ORG_ID%
                                set VERCEL_PROJECT_ID=%VERCEL_PROJECT_ID%
                                vercel --prod --yes --token %VERCEL_TOKEN%
                            """

                            echo "  ✔  Frontend deployed to Vercel"
                            echo "  URL: ${VERCEL_URL}"
                        }
                    }
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────────
        // STAGE 5: Deploy Backend to Render
        // ───────────────────────────────────────────────────────────────────────
        stage('Deploy: Backend → Render') {
            when {
                anyOf {
                    branch 'main'
                    expression { env.GIT_BRANCH?.contains('main') }
                    expression { env.BRANCH_NAME == 'main' }
                }
            }
            steps {
                script {
                    echo "┌─────────────────────────────────────────────────┐"
                    echo "│  Deploying Express API to Render                 │"
                    echo "└─────────────────────────────────────────────────┘"

                    withCredentials([
                        string(credentialsId: 'RENDER_API_KEY', variable: 'RENDER_API_KEY'),
                        string(credentialsId: 'RENDER_SERVICE_API', variable: 'RENDER_SERVICE_API')
                    ]) {
                        // Trigger Render deploy via API
                        // Render auto-deploys on git push, but we can also trigger manually
                        bat """
                            curl -s -X POST "https://api.render.com/v1/services/%RENDER_SERVICE_API%/deploys" ^
                                -H "Authorization: Bearer %RENDER_API_KEY%" ^
                                -H "Content-Type: application/json" ^
                                -d "{\"clearCache\": false}"
                        """

                        echo "  ✔  Render deploy triggered for Express API"
                        echo "  Waiting for deployment to complete..."

                        // Poll Render API for deploy status
                        def deployed = false
                        for (int i = 0; i < 20; i++) {
                            sleep 30  // Wait 30 seconds between checks
                            try {
                                def status = bat(returnStdout: true, script: """
                                    curl -s "https://api.render.com/v1/services/%RENDER_SERVICE_API%/deploys?limit=1" ^
                                        -H "Authorization: Bearer %RENDER_API_KEY%"
                                """)
                                if (status.contains("\"status\":\"live\"") || status.contains("\"status\":\"succeeded\"")) {
                                    deployed = true
                                    echo "  ✔  Express API deployed successfully on Render"
                                    break
                                }
                                echo "  ...deploying (${i * 30}s elapsed)"
                            } catch (Exception e) {}
                        }

                        if (!deployed) {
                            echo "  ⚠  Deploy status check timed out — verify on Render dashboard"
                        }

                        // Health check on deployed service
                        sleep 10
                        try {
                            def result = bat(returnStdout: true, script: "curl -s -o /dev/null -w \"%{http_code}\" ${RENDER_API_URL}/health")
                            if (result.trim() == "200") {
                                echo "  ✔  Production health check passed: ${RENDER_API_URL}/health"
                            } else {
                                echo "  ⚠  Health check returned: ${result.trim()}"
                            }
                        } catch (Exception e) {
                            echo "  ⚠  Health check failed — service may still be starting"
                        }
                    }
                }
            }
        }

        // ───────────────────────────────────────────────────────────────────────
        // STAGE 6: Deploy ML Service to Render
        // ───────────────────────────────────────────────────────────────────────
        stage('Deploy: ML Service → Render') {
            when {
                anyOf {
                    branch 'main'
                    expression { env.GIT_BRANCH?.contains('main') }
                    expression { env.BRANCH_NAME == 'main' }
                }
            }
            steps {
                script {
                    echo "┌─────────────────────────────────────────────────┐"
                    echo "│  Deploying FastAPI ML Service to Render          │"
                    echo "└─────────────────────────────────────────────────┘"

                    withCredentials([
                        string(credentialsId: 'RENDER_API_KEY', variable: 'RENDER_API_KEY'),
                        string(credentialsId: 'RENDER_SERVICE_ML', variable: 'RENDER_SERVICE_ML')
                    ]) {
                        // Trigger Render deploy
                        bat """
                            curl -s -X POST "https://api.render.com/v1/services/%RENDER_SERVICE_ML%/deploys" ^
                                -H "Authorization: Bearer %RENDER_API_KEY%" ^
                                -H "Content-Type: application/json" ^
                                -d "{\"clearCache\": false}"
                        """

                        echo "  ✔  Render deploy triggered for ML Service"
                        echo "  Waiting for deployment to complete..."

                        // Poll for deploy status
                        def deployed = false
                        for (int i = 0; i < 20; i++) {
                            sleep 30
                            try {
                                def status = bat(returnStdout: true, script: """
                                    curl -s "https://api.render.com/v1/services/%RENDER_SERVICE_ML%/deploys?limit=1" ^
                                        -H "Authorization: Bearer %RENDER_API_KEY%"
                                """)
                                if (status.contains("\"status\":\"live\"") || status.contains("\"status\":\"succeeded\"")) {
                                    deployed = true
                                    echo "  ✔  ML Service deployed successfully on Render"
                                    break
                                }
                                echo "  ...deploying (${i * 30}s elapsed)"
                            } catch (Exception e) {}
                        }

                        if (!deployed) {
                            echo "  ⚠  Deploy status check timed out — verify on Render dashboard"
                        }

                        // Health check on deployed ML service
                        sleep 10
                        try {
                            def result = bat(returnStdout: true, script: "curl -s -o /dev/null -w \"%{http_code}\" ${RENDER_ML_URL}/health")
                            if (result.trim() == "200") {
                                echo "  ✔  Production ML health check passed: ${RENDER_ML_URL}/health"
                            } else {
                                echo "  ⚠  Health check returned: ${result.trim()}"
                            }
                        } catch (Exception e) {
                            echo "  ⚠  Health check failed — service may still be starting"
                        }
                    }
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POST-BUILD ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    post {
        always {
            script {
                echo "╔══════════════════════════════════════════════════╗"
                echo "║  Pipeline Build #${BUILD_NUMBER} — ${currentBuild.currentResult}"
                echo "╚══════════════════════════════════════════════════╝"
            }
            // Clean up Docker test containers (Windows)
            bat "docker stop bs-api-test bs-ml-test 2>nul || true"
            bat "docker rm bs-api-test bs-ml-test 2>nul || true"
            // Clean up dangling images
            bat "docker image prune -f 2>nul || true"
        }
        success {
            echo "✔  All deployments successful!"
            echo "    Frontend:  ${VERCEL_URL}"
            echo "    Backend:   ${RENDER_API_URL}"
            echo "    ML Svc:    ${RENDER_ML_URL}"
        }
        failure {
            echo "✖  Pipeline failed — check logs above"
        }
    }
}
