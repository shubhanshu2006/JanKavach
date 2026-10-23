export type DensityColor = "green" | "amber" | "red" | "critical";
export type GateState = "open" | "restricted" | "closed";
export type SystemStatus = "normal" | "monitoring" | "active" | "critical";
export type InterventionStatus = "fired" | "staged" | "pending_confirm" | "cancelled" | "confirmed";
export type InterventionLevel = 1 | 2 | 3 | 4 | 5;

export interface FlowVector {
  dx: number;
  dy: number;
  magnitude: number;
}

export interface ZoneState {
  density: number;
  count: number;
  color: DensityColor;
  name: string;
  flow_vector: FlowVector;
}

export interface PredictionPoint {
  density: number;
  color: DensityColor;
}

export interface ZonePrediction {
  t30: PredictionPoint;
  t60: PredictionPoint;
  t90: PredictionPoint;
}

export interface Intervention {
  id: string;
  zone: string;
  level: InterventionLevel;
  trigger: string;
  action: string;
  timestamp: string;
  status: InterventionStatus;
  response_time_ms: number;
  countdown_remaining?: number;
  side?: "crowdguard" | "human";
}

export interface PersonBbox {
  x1: number; y1: number; x2: number; y2: number;
}

export interface LiveUpdate {
  elapsed: number;
  demo_running?: boolean;
  config_version?: number;
  crowdguard: {
    zones: Record<string, ZoneState>;
    predictions: Record<string, ZonePrediction>;
    l1_fired: boolean;
  };
  human: {
    zones: Record<string, ZoneState>;
    crush_occurred: boolean;
    human_responded: boolean;
  };
  interventions: Intervention[];
  staged: Intervention[];
  system_status: SystemStatus;
  persons?: PersonBbox[];
  video_ready?: boolean;
}

export interface ZoneBounds { x1: number; y1: number; x2: number; y2: number; }

export interface ZoneConfig {
  id: string;
  label: string;
  short_label: string;
  category_id: string;
  area_m2: number;
  camera_area_m2: number | null;
  bounds: ZoneBounds | null;
}

export interface CategoryConfig { id: string; label: string; color: string; }

export interface ThresholdConfig {
  density_safe: number;
  density_warning: number;
  density_critical: number;
  l1_trigger: number;
  l2_trigger: number;
  l3_trigger: number;
  pre_warn_trigger: number;
  failsafe_trigger: number;
  l2_countdown_seconds: number;
}

export interface ViewConfig {
  show_zone_chart: boolean;
  show_prediction_overlay: boolean;
  show_flow_vectors: boolean;
  show_critical_zones_panel: boolean;
  zone_display_order: string[];
}

export interface PresetConfig { name: string; view: ViewConfig; }

export interface StationConfig {
  zones: ZoneConfig[];
  categories: CategoryConfig[];
  thresholds: ThresholdConfig;
  view: ViewConfig;
  presets: PresetConfig[];
  video_width: number;
  video_height: number;
  version: number;
}
