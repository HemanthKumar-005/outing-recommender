FROM python:3.12-slim
WORKDIR /app
COPY services/model-training-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared /shared
COPY services/model-training-worker/train.py .
ENV PYTHONUNBUFFERED=1
CMD ["python", "train.py"]
