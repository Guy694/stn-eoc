import BaseTeamDashboard from "../teams/shared/components/base-team-dashboard";
import BaseTeamRecords from "../teams/shared/components/base-team-records";
import BaseTeamMembers from "../teams/shared/components/base-team-members";

export const defaultTeamModule = Object.freeze({
  Dashboard: BaseTeamDashboard,
  Records: BaseTeamRecords,
  Members: BaseTeamMembers,
});
