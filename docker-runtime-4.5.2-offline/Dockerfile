FROM rockylinux:8

# 离线 RPM 依赖（libvsag.so 的运行时）
COPY libquadmath-8.5.0-22.el8_10.x86_64.rpm /tmp/
COPY libgfortran-8.5.0-22.el8_10.x86_64.rpm /tmp/
COPY libgomp-8.5.0-22.el8_10.x86_64.rpm /tmp/
COPY tugraph-4.5.2-1.el8.x86_64.rpm /tmp/

RUN rpm -ivh /tmp/libquadmath-*.rpm && \
    rpm -ivh /tmp/libgfortran-*.rpm /tmp/libgomp-*.rpm && \
    rpm -ivh /tmp/tugraph-*.rpm && \
    rm /tmp/*.rpm

ENV LD_LIBRARY_PATH=/usr/local/lib64/lgraph:/usr/local/lib64
ENV PATH=/usr/local/bin:/usr/local/lib64/lgraph:$PATH

EXPOSE 7070 9090

# 使用 RPM 自带的默认配置
CMD ["lgraph_server", "-c", "/usr/local/etc/lgraph.json", "-d", "run"]
