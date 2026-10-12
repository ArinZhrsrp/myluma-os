# LUMA documentation

This branch contains project documentation and the user-manual website.
Application source, database migrations, deployment scripts and automated
application tests live on `development`, `staging` and `main`.

- [User manual](user-manual/index.html)
- [Manual preview and maintenance](user-manual/README.md)
- [Project documentation](docs/README.md)
- [Project overview and setup reference](docs/PROJECT-OVERVIEW.md)
- [Changelog](CHANGELOG.md)

Preview the manual with:

```sh
python3 -m http.server 8772 --directory user-manual
```

The branch's `vercel.json` publishes `user-manual/`. Documentation generators
and manual preview/capture tools are retained to maintain these artifacts.
Use a separate application checkout when refreshing screenshots, as described
in the manual README. Application paths in reference documents refer to that
checkout. Application tests are maintained under `tests/` on project branches;
older documentation may refer to their former `docs/test-automation/` path.

Do not merge this branch wholesale into application branches. Apply application
fixes to the project branches and maintain documentation here.
