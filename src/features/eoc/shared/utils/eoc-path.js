export function getTeamPath(eocType, teamCode, section = "dashboard") {
  return `/eoc/${encodeURIComponent(eocType)}/teams/${encodeURIComponent(teamCode)}/${section}`;
}
