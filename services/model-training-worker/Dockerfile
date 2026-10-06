FROM python:3.12-slim
WORKDIR /app
COPY services/model-training-worker/requirements.txt .
# Install numpy first so pip doesn't backtrack when resolving scipy deps
RUN pip install --no-cache-dir --timeout 120 numpy==1.26.4
RUN pip install --no-cache-dir --timeout 300 scipy==1.13.1
RUN pip install --no-cache-dir --timeout 300 -r requirements.txt
COPY shared /shared
COPY services/model-training-worker/train.py .
ENV PYTHONUNBUFFERED=1
CMD ["python", "train.py"]
