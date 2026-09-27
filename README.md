# Forced Rolls

A Foundry VTT module that lets the GM decide the result of upcoming dice rolls, for any user and any die size.

## Install

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/jdbl/forced-rolls/releases/latest/download/module.json
```

Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper). Enable both in **Game Settings → Manage Modules**.

## Use

As GM, open the dialog with the d20 button in the **Token controls** toolbar, or press **Shift+Alt+F**.

Pick a user, a die, and one or more results (`20` or `20, 20`). Each die of that size the user rolls next takes the next queued result. The roll goes through Foundry normally, so Dice So Nice, crits and automation all see the forced value.

Notes:
- Every die consumes a value: an advantage roll (`2d20kh`) uses two queued d20 results.
- The dialog lists what is queued and can clear one user or everyone.

## Scripting

```js
const fr = game.modules.get("forced-rolls").api;
await fr.force("Player Name", "d20", 20);
fr.peek("Player Name");
await fr.clear();          // everyone
fr.openDialog();
```

## Releasing (maintainers)

1. Bump nothing by hand; create a GitHub release with a tag like `v1.2.0`.
2. The Release workflow stamps that version into `module.json`, builds `module.zip`, and attaches both to the release.
