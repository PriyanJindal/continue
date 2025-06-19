#!/usr/bin/env bash
# This is used in a task in .vscode/tasks.json
# Start developing with:
# - Run Task -> Install Dependencies
# - Debug -> Extension
set -e

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if node version matches .nvmrc and auto-switch if possible
if [ -f .nvmrc ]; then
    required_node_version=$(cat .nvmrc)
    current_node_version=$(node -v)
    
    # Remove 'v' prefix from versions for comparison
    required_version=${required_node_version#v}
    current_version=${current_node_version#v}

    if [ "$required_version" != "$current_version" ]; then
        echo "⚠️  Current Node.js version ($current_node_version) does not match required version ($required_node_version)"
        
        # Try to use nvm to switch versions automatically
        if command -v nvm &> /dev/null; then
            echo "🔄 Attempting to switch to the correct Node version using nvm..."
            nvm use
            echo "✅ Successfully switched to Node $(node -v)"
        else
            echo "❌ nvm not found. Please install nvm or manually switch to Node $required_node_version"
            echo "To install nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
            
            if [ -t 0 ]; then
                read -p "Press Enter to continue with installation anyway..."
            else
                echo "Continuing with installation anyway..."
            fi
        fi
        echo
    else
        echo "✅ Node version matches required version ($current_node_version)"
    fi
fi

echo "Installing root-level dependencies..."
npm install

echo "Building config-yaml..."
pushd packages/config-yaml
npm install
npm run build
popd

echo "Installing Core extension dependencies..."
pushd core
## This flag is set because we pull down Chromium at runtime
export PUPPETEER_SKIP_DOWNLOAD='true'
npm install
npm install @arizeai/openinference-instrumentation-openai @arizeai/openinference-semantic-conventions @opentelemetry/semantic-conventions @opentelemetry/api @opentelemetry/instrumentation @opentelemetry/resources @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-proto
npm link
popd

echo "Installing GUI extension dependencies..."
pushd gui
npm install
npm link @continuedev/core
npm run build
popd

# VSCode Extension (will also package GUI)
echo "Installing VSCode extension dependencies..."
pushd extensions/vscode
# This does way too many things inline but is the common denominator between many of the scripts
npm install
npm link @continuedev/core
npm run prepackage
npm run package
popd

echo "Installing binary dependencies..."
pushd binary
npm install
npm run build
popd

echo "Installing docs dependencies..."
pushd docs
npm install
popd
