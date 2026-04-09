FROM python:3.10-slim
WORKDIR /app
# Install library yang dibutuhin
RUN pip install prometheus_client requests
# Copy script ke dalem image
COPY exporter_ryu.py .
# Jalankan scriptnya
CMD ["python", "exporter_ryu.py"]
