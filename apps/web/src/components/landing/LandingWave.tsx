type LandingWaveVariant = "to-muted" | "to-default";

type LandingWaveProps = {
  variant: LandingWaveVariant;
};

const WAVE_PATHS: Record<LandingWaveVariant, string> = {
  "to-muted":
    "M0,44 C240,68 480,20 720,44 C960,68 1200,20 1440,44 L1440,80 L0,80 Z",
  "to-default":
    "M0,36 C240,12 480,60 720,36 C960,12 1200,60 1440,36 L1440,80 L0,80 Z",
};

export function LandingWave({ variant }: LandingWaveProps) {
  return (
    <div className={`landing-wave landing-wave--${variant}`} aria-hidden>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d={WAVE_PATHS[variant]} />
      </svg>
    </div>
  );
}
