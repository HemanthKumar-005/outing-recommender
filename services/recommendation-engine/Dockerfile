FROM python:3.12-slim
WORKDIR /app
COPY services/recommendation-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared /shared
COPY configs /configs
COPY data /data
COPY services/recommendation-engine/app ./app
ENV PYTHONUNBUFFERED=1
ENV CONFIG_ROOT=/configs
ENV DATA_ROOT=/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
