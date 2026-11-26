# Changelog

## [0.2.1](https://github.com/zgeoff/wherewerewe/compare/@wherewerewe/cli@0.2.0...@wherewerewe/cli@0.2.1) (2026-11-26)

### Bug Fixes

- teach the skill to write the owner's meaning and prune the brief
  ([#53](https://github.com/zgeoff/wherewerewe/issues/53))
  ([3dd3879](https://github.com/zgeoff/wherewerewe/commit/3dd38790293c5897ad97de29030d0bc8ee780eef))

## [0.2.0](https://github.com/zgeoff/wherewerewe/compare/@wherewerewe/cli@0.1.0...@wherewerewe/cli@0.2.0) (2026-11-25)

### ⚠ BREAKING CHANGES

- the commands list, show, log, recap, say, ack, ok, use and import are gone, with checks, owner
  notes and row caps. www install replaces the 0.1 hook entries with two per host.

### Features

- rebuild www as one table of labelled rows ([#50](https://github.com/zgeoff/wherewerewe/issues/50))
  ([f010598](https://github.com/zgeoff/wherewerewe/commit/f010598b0ad2c14a2cdf10a9f5c58657aec51599))

## [0.1.0](https://github.com/zgeoff/wherewerewe/compare/@wherewerewe/cli@0.0.1...@wherewerewe/cli@0.1.0) (2026-11-25)

### Features

- add approvals, decisions, show and log ([#15](https://github.com/zgeoff/wherewerewe/issues/15))
  ([6a7148a](https://github.com/zgeoff/wherewerewe/commit/6a7148ab88539bc4935b1748555ddeedec6ae8a0))
- add the import of a hand-kept store ([#16](https://github.com/zgeoff/wherewerewe/issues/16))
  ([b8282e7](https://github.com/zgeoff/wherewerewe/commit/b8282e7a69a7973b66289bef16063c5972f55e2b))
- add the store, the note writes and the brief
  ([#14](https://github.com/zgeoff/wherewerewe/issues/14))
  ([a278e2a](https://github.com/zgeoff/wherewerewe/commit/a278e2aadfec9a267d1e1f3b4924d933b36efaaa))
- **cli:** add json reads and a /goal paste of the grant
  ([#42](https://github.com/zgeoff/wherewerewe/issues/42))
  ([39c681a](https://github.com/zgeoff/wherewerewe/commit/39c681ad073fdbcfc8247531bf2e1d7facb62dd5))
- **cli:** add notes on items with --note and --owed
  ([#22](https://github.com/zgeoff/wherewerewe/issues/22))
  ([62d38a8](https://github.com/zgeoff/wherewerewe/commit/62d38a84ae64589bafa54ca6345bb456c1dac83a))
- **cli:** add owner notes with say and ack ([#19](https://github.com/zgeoff/wherewerewe/issues/19))
  ([0f1521f](https://github.com/zgeoff/wherewerewe/commit/0f1521ff575847479bebf4bf090d66f52eed331c))
- **cli:** add the checks ([#32](https://github.com/zgeoff/wherewerewe/issues/32))
  ([810e23e](https://github.com/zgeoff/wherewerewe/commit/810e23e6f2b711861180d409f92516ab75e07cdc))
- **cli:** add the grant and store format 2 ([#24](https://github.com/zgeoff/wherewerewe/issues/24))
  ([b80e1d0](https://github.com/zgeoff/wherewerewe/commit/b80e1d0b447ef9905c34ed785288e86ef4e09a5f))
- **cli:** add the hooks, the gate, www install and www doctor
  ([#44](https://github.com/zgeoff/wherewerewe/issues/44))
  ([3f02596](https://github.com/zgeoff/wherewerewe/commit/3f02596f1fa26e062617a718c7dbdaa7f84086a6))
- **cli:** add www recap for the owner ([#26](https://github.com/zgeoff/wherewerewe/issues/26))
  ([38b044f](https://github.com/zgeoff/wherewerewe/commit/38b044faa925d997c36212d41775249bcfecd6f4))
- **cli:** hold 30 open tasks and size the brief for its host
  ([#28](https://github.com/zgeoff/wherewerewe/issues/28))
  ([5fdaa5e](https://github.com/zgeoff/wherewerewe/commit/5fdaa5ec5e18501f89716ac835671ba5a281c17a))
- **cli:** hold the brief to a token limit and add three new kinds
  ([#38](https://github.com/zgeoff/wherewerewe/issues/38))
  ([29b535d](https://github.com/zgeoff/wherewerewe/commit/29b535deba2b766c19c0b2d36730e129f5c312ed))
- ship compiled binaries through a brew tap and an install script
  ([#43](https://github.com/zgeoff/wherewerewe/issues/43))
  ([32e57b7](https://github.com/zgeoff/wherewerewe/commit/32e57b739b7a3baf9f8418924ba13abe328b7485))
- take a grant of limits alone and bound its bullets by lines
  ([#30](https://github.com/zgeoff/wherewerewe/issues/30))
  ([66559dd](https://github.com/zgeoff/wherewerewe/commit/66559dd4ca782f0efc85ed9d0cc74d72d27ac335))

### Bug Fixes

- **cli:** keep the store lock sound when a process cannot be checked
  ([#18](https://github.com/zgeoff/wherewerewe/issues/18))
  ([dabbf6b](https://github.com/zgeoff/wherewerewe/commit/dabbf6b258e39d0ff133cba70ce16e33b05e7f4e))
- **cli:** name a command's flags in its refusal and prove two checks
  ([#36](https://github.com/zgeoff/wherewerewe/issues/36))
  ([4c9f11c](https://github.com/zgeoff/wherewerewe/commit/4c9f11c5c780b8d50df73326d9880165926889ea))
- name the release branch after its component
  ([#46](https://github.com/zgeoff/wherewerewe/issues/46))
  ([9696e1d](https://github.com/zgeoff/wherewerewe/commit/9696e1db0c81e73e87cebf1db0d8dd0f5e421cad))
