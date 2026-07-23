import BaseTeamDashboard from "../teams/shared/components/base-team-dashboard";
import SatDashboard from "../teams/sat/components/sat-dashboard";
import ItDashboard from "../teams/it/components/it-dashboard";
import RiskcomDashboard from "../teams/riskcom/components/riskcom-dashboard";
import LogisticsDashboard from "../teams/logistics/components/logistics-dashboard";
import DengueSatDashboard from "../eoc-types/dengue/sat/components/dengue-sat-dashboard";
import FloodSatDashboard from "../eoc-types/flood/sat/components/flood-sat-dashboard";

export const defaultTeamDashboard = BaseTeamDashboard;

export const baseTeamDashboardRegistry = Object.freeze({
  sat: SatDashboard,
  it: ItDashboard,
  riskcom: RiskcomDashboard,
  logistics: LogisticsDashboard,
});

export const eocTypeTeamDashboardRegistry = Object.freeze({
  "dengue:sat": DengueSatDashboard,
  "flood:sat": FloodSatDashboard,
});
