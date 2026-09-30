FROM python:3.12-slim
WORKDIR /app
COPY services/sentiment-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared /shared
COPY services/sentiment-worker/worker.py .
ENV PYTHONUNBUFFERED=1
CMD ["python", "worker.py"]
