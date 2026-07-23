import { teamRegistry } from "./team.registry";

export const navigationRegistry = Object.freeze(
  Object.fromEntries(Object.entries(teamRegistry).map(([code, team]) => [code, team.menus]))
);
