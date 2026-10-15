FROM python:3.12-slim
WORKDIR /app
COPY services/sentiment-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared /shared
COPY services/sentiment-worker/worker.py .

# Model weights are not baked in at Docker build time to keep image size small and build times fast.
# Instead, weights are downloaded lazily upon first inference run and cached persistently in the
# volume mounted at HF_HOME (/root/.cache/huggingface).
ENV HF_HOME=/root/.cache/huggingface
ENV PYTHONUNBUFFERED=1
CMD ["python", "worker.py"]
