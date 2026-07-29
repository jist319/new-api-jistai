# Non-root Container Runtime

Images built from `Dockerfile` and `Dockerfile.dev` run as UID/GID `65532:65532`.
The image-owned `/data` and `/app/logs` directories are already writable, and
`/tmp` has mode `1777`.

Existing bind mounts or populated named volumes can retain ownership from an
older root container. Before switching an existing installation to this image:

1. Stop only the target application after deployment approval and take a
   verified backup.
2. Resolve the exact host paths or volume mountpoints for `/data` and
   `/app/logs`. Do not use shell globs or unresolved environment variables.
3. Inspect their current owner and mode, for example:

   ```bash
   stat -c '%u:%g %a %n' /srv/example/new-api/data /srv/example/new-api/logs
   ```

4. If those directories are dedicated to this container, update the exact
   paths and verify them again:

   ```bash
   sudo chown -R 65532:65532 -- /srv/example/new-api/data /srv/example/new-api/logs
   ```

Do not change shared directory ownership. Use a dedicated group or ACL when
another service must access the same files. For a custom application port, set
`PORT`; when the application is started with `--port` instead, also set
`HEALTHCHECK_PORT` to the same value.
