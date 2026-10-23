FROM python:3.12-slim
WORKDIR /app
COPY services/model-training-worker/requirements.txt .
# Install heavy wheels first to avoid backtracking and socket timeouts
RUN pip install --no-cache-dir --prefer-binary --retries 5 --timeout 120 numpy==1.26.4
RUN pip install --no-cache-dir --prefer-binary --retries 5 --timeout 120 scipy==1.13.1
RUN pip install --no-cache-dir --prefer-binary --retries 5 --timeout 120 -r requirements.txt
COPY shared /shared
COPY services/model-training-worker/train.py .
ENV PYTHONUNBUFFERED=1
CMD ["python", "train.py"]
