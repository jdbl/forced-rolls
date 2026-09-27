const MODULE_ID = "forced-rolls";
const DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

/**
 * The queue lives in a flag on the User who will roll, shaped like
 * { d20: [20, 1], d6: [6] }. Each die of that size rolled by that user
 * takes the next value from its list. The GM writes to it and the rolling
 * client removes values as it uses them.
 */
function getQueue(user) {
  return foundry.utils.deepClone(user.getFlag(MODULE_ID, "queue") ?? {});
}

function findUser(userNameOrId) {
  return game.users.get(userNameOrId) ?? game.users.getName(userNameOrId);
}

const api = {
  /** Add results for a user. Example: force("Barry", "d20", 20, 20) */
  async force(userNameOrId, die, ...values) {
    const user = findUser(userNameOrId);
    if (!user) throw new Error(`${MODULE_ID} | No user "${userNameOrId}"`);
    const queue = getQueue(user);
    (queue[die] ??= []).push(...values.map(Number).filter(Number.isFinite));
    await user.setFlag(MODULE_ID, "queue", queue);
    return queue;
  },

  /** Clear one user's queue, or every user's queue if no user is given. */
  async clear(userNameOrId) {
    const users = userNameOrId ? [findUser(userNameOrId)] : game.users.contents;
    for (const u of users) if (u) await u.unsetFlag(MODULE_ID, "queue");
  },

  peek(userNameOrId) {
    const user = findUser(userNameOrId);
    return user ? getQueue(user) : null;
  },

  /** Open the GM dialog for queuing results. */
  async openDialog() {
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can force rolls.");
    const { DialogV2 } = foundry.applications.api;
    const esc = foundry.utils.escapeHTML;

    const queueSummary = game.users.map(u => {
      const q = Object.entries(getQueue(u)).filter(([, v]) => v.length);
      if (!q.length) return "";
      return `<li><strong>${esc(u.name)}</strong>: ${q.map(([d, v]) => `${d} → ${v.join(", ")}`).join("; ")}</li>`;
    }).join("");

    const userOptions = game.users.map(u =>
      `<option value="${u.id}" ${u.isSelf ? "selected" : ""}>${esc(u.name)}${u.active ? "" : " (offline)"}</option>`
    ).join("");
    const dieOptions = DICE.map(d => `<option value="${d}" ${d === "d20" ? "selected" : ""}>${d}</option>`).join("");

    const content = `
      <div class="form-group"><label>User</label><select name="user">${userOptions}</select></div>
      <div class="form-group"><label>Die</label><select name="die">${dieOptions}</select></div>
      <div class="form-group"><label>Results</label>
        <input type="text" name="values" placeholder="e.g. 20 or 20, 20" autofocus></div>
      <p class="hint">Each die of this size the user rolls takes the next result. Advantage uses two d20s.</p>
      ${queueSummary ? `<hr><p><strong>Currently queued</strong></p><ul>${queueSummary}</ul>` : ""}`;

    const formData = (_e, button) => new foundry.applications.ux.FormDataExtended(button.form).object;
    const result = await DialogV2.wait({
      window: { title: "Force Rolls", icon: "fa-solid fa-dice-d20" },
      position: { width: 420 },
      content,
      buttons: [
        { action: "force", label: "Queue", icon: "fa-solid fa-check", default: true,
          callback: (e, b) => ({ action: "force", ...formData(e, b) }) },
        { action: "clearUser", label: "Clear User", icon: "fa-solid fa-eraser",
          callback: (e, b) => ({ action: "clearUser", ...formData(e, b) }) },
        { action: "clearAll", label: "Clear All", icon: "fa-solid fa-trash",
          callback: () => ({ action: "clearAll" }) }
      ]
    });
    if (!result) return;

    const userName = game.users.get(result.user)?.name;
    if (result.action === "clearAll") {
      await api.clear();
      ui.notifications.info("Cleared all forced rolls.");
    } else if (result.action === "clearUser") {
      await api.clear(result.user);
      ui.notifications.info(`Cleared forced rolls for ${userName}.`);
    } else {
      const values = String(result.values ?? "").split(/[,\s]+/).filter(Boolean);
      if (!values.length) return ui.notifications.warn("Enter at least one result.");
      await api.force(result.user, result.die, ...values);
      ui.notifications.info(`Queued ${result.die}: ${values.join(", ")} for ${userName}.`);
    }
  }
};

Hooks.once("init", () => {
  libWrapper.register(
    MODULE_ID,
    "foundry.dice.terms.DiceTerm.prototype._roll",
    async function (wrapped, options = {}) {
      const key = `d${this.faces}`;
      const queue = getQueue(game.user);
      const list = queue[key];
      if (list?.length) {
        const value = Math.clamp(Number(list.shift()), 1, this.faces);
        await game.user.setFlag(MODULE_ID, "queue", queue);
        return value;
      }
      return wrapped(options);
    },
    "MIXED"
  );

  game.keybindings.register(MODULE_ID, "openDialog", {
    name: "Open Force Rolls dialog",
    editable: [{ key: "KeyF", modifiers: ["Shift", "Alt"] }],
    restricted: true,
    onDown: () => { api.openDialog(); return true; }
  });

  game.modules.get(MODULE_ID).api = api;
});

// GM-only button in the Token controls toolbar on the left.
Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens;
  if (!tokens || !game.user.isGM) return;
  tokens.tools.forcedRolls = {
    name: "forcedRolls",
    title: "Force Rolls",
    icon: "fa-solid fa-dice-d20",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => api.openDialog()
  };
});
