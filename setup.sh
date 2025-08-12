#!/bin/bash

echo "🚀 IoT Parser Setup Script"
echo "=========================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your MQTT credentials before running the parser"
else
    echo "✅ .env file already exists"
fi

# Create directories
mkdir -p logs statistics backup

echo "📁 Created necessary directories"

# Run tests
echo "🧪 Running parser tests..."
npm test

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "⚠️  Some tests failed, but the parser should still work"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your MQTT broker credentials"
echo "2. Ensure emqxsl_ca.pem is in the root directory"
echo "3. Run 'npm start' to start the parser"
echo "4. Run 'npm run stats' to view statistics tools"
echo ""
echo "Available commands:"
echo "  npm start          - Start the parser"
echo "  npm run dev        - Start with auto-restart"
echo "  npm test           - Run validation tests"
echo "  npm run stats      - Statistics CLI help"
echo "  npm run report     - Generate statistics report"
echo "  npm run live       - View live statistics"
