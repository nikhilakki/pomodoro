use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Pomodoro phases.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Focus,
    ShortBreak,
    LongBreak,
}

impl Phase {
    pub fn as_str(&self) -> &'static str {
        match self {
            Phase::Focus => "focus",
            Phase::ShortBreak => "short_break",
            Phase::LongBreak => "long_break",
        }
    }

    pub fn from_str(s: &str) -> Option<Phase> {
        match s {
            "focus" => Some(Phase::Focus),
            "short_break" => Some(Phase::ShortBreak),
            "long_break" => Some(Phase::LongBreak),
            _ => None,
        }
    }

    pub fn is_break(&self) -> bool {
        !matches!(self, Phase::Focus)
    }
}

/// Timer status. `Running` stores the absolute deadline so the timer never
/// drifts; `Paused` stores the remaining duration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Idle,
    Running { ends_at: Instant },
    Paused { remaining: Duration },
}

impl Status {
    pub fn as_str(&self) -> &'static str {
        match self {
            Status::Idle => "idle",
            Status::Running { .. } => "running",
            Status::Paused { .. } => "paused",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub focus_min: u32,
    pub short_break_min: u32,
    pub long_break_min: u32,
    pub long_break_every: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
    pub sound: bool,
    pub notifications: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            focus_min: 25,
            short_break_min: 5,
            long_break_min: 15,
            long_break_every: 4,
            auto_start_breaks: true,
            auto_start_focus: true,
            sound: true,
            notifications: true,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Event {
    Start,
    Pause,
    Resume,
    Toggle,
    Skip,
    Reset,
    SetPhase(Phase),
    Tick,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Effect {
    PhaseCompleted {
        from: Phase,
        to: Phase,
        auto_started: bool,
    },
}

#[derive(Debug, Clone)]
pub struct Timer {
    pub phase: Phase,
    pub status: Status,
    pub completed_focus: u32,
}

impl Default for Timer {
    fn default() -> Self {
        Self::new()
    }
}

impl Timer {
    pub fn new() -> Self {
        Self {
            phase: Phase::Focus,
            status: Status::Idle,
            completed_focus: 0,
        }
    }

    pub fn phase_duration(&self, s: &Settings) -> Duration {
        let mins = match self.phase {
            Phase::Focus => s.focus_min,
            Phase::ShortBreak => s.short_break_min,
            Phase::LongBreak => s.long_break_min,
        };
        Duration::from_secs(u64::from(mins.max(1)) * 60)
    }

    pub fn remaining(&self, s: &Settings, now: Instant) -> Duration {
        match self.status {
            Status::Idle => self.phase_duration(s),
            Status::Paused { remaining } => remaining,
            Status::Running { ends_at } => ends_at.saturating_duration_since(now),
        }
    }

    /// Which break follows a focus session, given `completed_focus` already
    /// reflects the just-finished session.
    fn break_after_completed_focus(&self, s: &Settings) -> Phase {
        if self.completed_focus % s.long_break_every.max(1) == 0 {
            Phase::LongBreak
        } else {
            Phase::ShortBreak
        }
    }

    fn enter_phase(&mut self, phase: Phase, s: &Settings, now: Instant, auto_start: bool) {
        self.phase = phase;
        self.status = if auto_start {
            Status::Running {
                ends_at: now + self.phase_duration(s),
            }
        } else {
            Status::Idle
        };
    }

    pub fn apply(&mut self, event: Event, s: &Settings, now: Instant) -> Option<Effect> {
        match event {
            Event::Start => {
                if matches!(self.status, Status::Idle) {
                    self.status = Status::Running {
                        ends_at: now + self.phase_duration(s),
                    };
                }
                None
            }
            Event::Pause => {
                if let Status::Running { ends_at } = self.status {
                    self.status = Status::Paused {
                        remaining: ends_at.saturating_duration_since(now),
                    };
                }
                None
            }
            Event::Resume => {
                if let Status::Paused { remaining } = self.status {
                    self.status = Status::Running {
                        ends_at: now + remaining,
                    };
                }
                None
            }
            Event::Toggle => {
                match self.status {
                    Status::Idle => {
                        self.status = Status::Running {
                            ends_at: now + self.phase_duration(s),
                        };
                    }
                    Status::Running { ends_at } => {
                        self.status = Status::Paused {
                            remaining: ends_at.saturating_duration_since(now),
                        };
                    }
                    Status::Paused { remaining } => {
                        self.status = Status::Running {
                            ends_at: now + remaining,
                        };
                    }
                }
                None
            }
            Event::Skip => {
                // Skipping a focus moves to the break that *would* follow,
                // but does not count the skipped session.
                let to = match self.phase {
                    Phase::Focus => {
                        let hypothetical = self.completed_focus + 1;
                        if hypothetical % s.long_break_every.max(1) == 0 {
                            Phase::LongBreak
                        } else {
                            Phase::ShortBreak
                        }
                    }
                    Phase::ShortBreak | Phase::LongBreak => Phase::Focus,
                };
                self.enter_phase(to, s, now, false);
                None
            }
            Event::Reset => {
                *self = Timer::new();
                None
            }
            Event::SetPhase(phase) => {
                self.phase = phase;
                self.status = Status::Idle;
                None
            }
            Event::Tick => {
                if let Status::Running { ends_at } = self.status {
                    if now >= ends_at {
                        let from = self.phase;
                        if from == Phase::Focus {
                            self.completed_focus += 1;
                        }
                        let to = match from {
                            Phase::Focus => self.break_after_completed_focus(s),
                            Phase::ShortBreak | Phase::LongBreak => Phase::Focus,
                        };
                        let auto = match to {
                            Phase::Focus => s.auto_start_focus,
                            Phase::ShortBreak | Phase::LongBreak => s.auto_start_breaks,
                        };
                        self.enter_phase(to, s, now, auto);
                        return Some(Effect::PhaseCompleted {
                            from,
                            to,
                            auto_started: auto,
                        });
                    }
                }
                None
            }
        }
    }

    pub fn snapshot(&self, s: &Settings, now: Instant) -> TimerSnapshot {
        TimerSnapshot {
            phase: self.phase.as_str().to_string(),
            status: self.status.as_str().to_string(),
            remaining_ms: self.remaining(s, now).as_millis() as u64,
            total_ms: self.phase_duration(s).as_millis() as u64,
            completed_focus: self.completed_focus,
            long_break_every: s.long_break_every,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TimerSnapshot {
    pub phase: String,
    pub status: String,
    pub remaining_ms: u64,
    pub total_ms: u64,
    pub completed_focus: u32,
    pub long_break_every: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings() -> Settings {
        Settings::default()
    }

    #[test]
    fn starts_idle_with_full_focus_duration() {
        let t = Timer::new();
        let s = settings();
        let now = Instant::now();
        let snap = t.snapshot(&s, now);
        assert_eq!(snap.status, "idle");
        assert_eq!(snap.phase, "focus");
        assert_eq!(snap.remaining_ms, 25 * 60 * 1000);
    }

    #[test]
    fn start_begins_running() {
        let mut t = Timer::new();
        let s = settings();
        let now = Instant::now();
        t.apply(Event::Start, &s, now);
        let snap = t.snapshot(&s, now);
        assert_eq!(snap.status, "running");
        assert_eq!(snap.remaining_ms, 25 * 60 * 1000);
    }

    #[test]
    fn pause_and_resume_preserves_remaining() {
        let mut t = Timer::new();
        let s = settings();
        let t0 = Instant::now();
        t.apply(Event::Start, &s, t0);

        // 5 minutes pass
        let t1 = t0 + Duration::from_secs(5 * 60);
        t.apply(Event::Pause, &s, t1);
        let snap = t.snapshot(&s, t1);
        assert_eq!(snap.status, "paused");
        assert_eq!(snap.remaining_ms, 20 * 60 * 1000);

        // much later, resume — remaining must not have decayed while paused
        let t2 = t1 + Duration::from_secs(3600);
        let snap = t.snapshot(&s, t2);
        assert_eq!(snap.remaining_ms, 20 * 60 * 1000);

        t.apply(Event::Resume, &s, t2);
        let snap = t.snapshot(&s, t2 + Duration::from_secs(60));
        assert_eq!(snap.status, "running");
        assert_eq!(snap.remaining_ms, 19 * 60 * 1000);
    }

    #[test]
    fn focus_completion_auto_starts_short_break() {
        let mut t = Timer::new();
        let s = settings();
        let t0 = Instant::now();
        t.apply(Event::Start, &s, t0);

        let after = t0 + Duration::from_secs(25 * 60 + 1);
        let effect = t.apply(Event::Tick, &s, after);
        assert_eq!(
            effect,
            Some(Effect::PhaseCompleted {
                from: Phase::Focus,
                to: Phase::ShortBreak,
                auto_started: true,
            })
        );
        let snap = t.snapshot(&s, after);
        assert_eq!(snap.phase, "short_break");
        assert_eq!(snap.status, "running");
        assert_eq!(snap.completed_focus, 1);
    }

    #[test]
    fn fourth_focus_completion_triggers_long_break() {
        let mut t = Timer::new();
        let s = settings();
        let mut now = Instant::now();

        for i in 1..=4u32 {
            // run focus to completion
            t.apply(Event::Start, &s, now);
            now += Duration::from_secs(u64::from(s.focus_min) * 60 + 1);
            let effect = t.apply(Event::Tick, &s, now);
            assert!(matches!(effect, Some(Effect::PhaseCompleted { from: Phase::Focus, .. })));
            assert_eq!(t.completed_focus, i);

            // run the break (or check) to completion
            if i < 4 {
                assert_eq!(t.phase, Phase::ShortBreak);
                now += Duration::from_secs(u64::from(s.short_break_min) * 60 + 1);
                let effect = t.apply(Event::Tick, &s, now);
                assert!(matches!(effect, Some(Effect::PhaseCompleted { to: Phase::Focus, .. })));
            } else {
                assert_eq!(t.phase, Phase::LongBreak);
            }
        }
    }

    #[test]
    fn skipped_focus_does_not_count_toward_long_break() {
        let mut t = Timer::new();
        let s = settings();
        let now = Instant::now();

        // skip 3 focus sessions
        for _ in 0..3 {
            t.apply(Event::Skip, &s, now); // -> break
            t.apply(Event::Skip, &s, now); // -> focus
        }
        assert_eq!(t.completed_focus, 0);
        assert_eq!(t.phase, Phase::Focus);

        // 4th skip from focus goes to short break (hypothetical 1 % 4 != 0)
        t.apply(Event::Skip, &s, now);
        assert_eq!(t.phase, Phase::ShortBreak);
    }

    #[test]
    fn break_completion_goes_back_to_focus() {
        let mut t = Timer::new();
        let s = settings();
        let t0 = Instant::now();
        t.apply(Event::Skip, &s, t0); // focus -> short break (idle)
        t.apply(Event::Start, &s, t0);
        let after = t0 + Duration::from_secs(5 * 60 + 1);
        let effect = t.apply(Event::Tick, &s, after);
        assert_eq!(
            effect,
            Some(Effect::PhaseCompleted {
                from: Phase::ShortBreak,
                to: Phase::Focus,
                auto_started: true,
            })
        );
        assert_eq!(t.phase, Phase::Focus);
    }

    #[test]
    fn no_auto_start_leaves_timer_idle() {
        let mut t = Timer::new();
        let s = Settings {
            auto_start_breaks: false,
            auto_start_focus: false,
            ..Settings::default()
        };
        let t0 = Instant::now();
        t.apply(Event::Start, &s, t0);
        let after = t0 + Duration::from_secs(25 * 60 + 1);
        let effect = t.apply(Event::Tick, &s, after);
        assert_eq!(
            effect,
            Some(Effect::PhaseCompleted {
                from: Phase::Focus,
                to: Phase::ShortBreak,
                auto_started: false,
            })
        );
        let snap = t.snapshot(&s, after);
        assert_eq!(snap.status, "idle");
        assert_eq!(snap.remaining_ms, 5 * 60 * 1000);
    }

    #[test]
    fn reset_clears_cycle_and_state() {
        let mut t = Timer::new();
        let s = settings();
        let now = Instant::now();
        t.apply(Event::Start, &s, now);
        t.apply(Event::Skip, &s, now);
        t.completed_focus = 3;
        t.apply(Event::Reset, &s, now);
        assert_eq!(t.phase, Phase::Focus);
        assert_eq!(t.status, Status::Idle);
        assert_eq!(t.completed_focus, 0);
    }

    #[test]
    fn set_phase_idles_with_new_duration() {
        let mut t = Timer::new();
        let s = settings();
        let now = Instant::now();
        t.apply(Event::Start, &s, now);
        t.apply(Event::SetPhase(Phase::LongBreak), &s, now);
        let snap = t.snapshot(&s, now);
        assert_eq!(snap.phase, "long_break");
        assert_eq!(snap.status, "idle");
        assert_eq!(snap.remaining_ms, 15 * 60 * 1000);
    }

    #[test]
    fn tick_before_deadline_does_nothing() {
        let mut t = Timer::new();
        let s = settings();
        let t0 = Instant::now();
        t.apply(Event::Start, &s, t0);
        let effect = t.apply(Event::Tick, &s, t0 + Duration::from_secs(60));
        assert_eq!(effect, None);
        assert_eq!(t.phase, Phase::Focus);
    }
}
