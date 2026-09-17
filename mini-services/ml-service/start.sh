#!/bin/bash
# Start script for the Python ML service
# Runs uvicorn with auto-restart on crash

cd /home/z/my-project/mini-services/ml-service

while true; do
  echo "[$(date)] Starting ML service..."
  uv run uvicorn main:app --host 0.0.0.0 --port 3030 --workers 1 --timeout-keep-alive 30 2>&1
  echo "[$(date)] ML service exited (code $?), restarting in 3s..."
  sleep 3
done
