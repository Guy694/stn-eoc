import TeamRouteGuard from "../shared/components/team-route-guard";
import BaseTeamMembers from "../teams/shared/components/base-team-members";

export default function TeamMembersEntry({ eocType, teamCode }) {
  return (
    <TeamRouteGuard eocType={eocType} teamCode={teamCode}>
      <BaseTeamMembers eocType={eocType} teamCode={teamCode} />
    </TeamRouteGuard>
  );
}
