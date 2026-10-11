import { describe, expect, it } from "vitest";
import { ENVIRONMENT } from "../game/Constants";
import { ThemeSystem, THEMES } from "./ThemeSystem";

describe("ThemeSystem", () => {
  it("uses this run's score instead of distance once score progress is supplied", () => {
    const themes = new ThemeSystem();
    themes.setScore(1499);
    expect(themes.atDistance(90000).id).toBe("spring");
    themes.setScore(1500);
    expect(themes.atDistance(0).id).toBe("summer");
    expect(themes.visualAtDistance(9000).theme.id).toBe("summer");
    themes.setScore(4500);
    expect(themes.visualAtDistance(9000, true)).toMatchObject({ theme: { id: "winter" }, dayPhase: "morning" });
    themes.setTheme("spring");
    expect(themes.atScore(4500).id).toBe("spring");
    themes.setTheme(null);
    expect(themes.atScore(4500).id).toBe("winter");
    themes.setScore(0);
    expect(themes.atDistance(90000).id).toBe("spring");
  });

  it("preserves generated season colors while retaining the existing day tint cycle", () => {
    const themes = new ThemeSystem();
    themes.setScore(3000);
    expect(themes.visualAtDistance(0, false, true)).toMatchObject({ skyTint: 0xffffff, landTint: 0xffffff });
    expect(themes.visualAtDistance(9000, false, true)).toMatchObject({ skyTint: 0x8290ae, landTint: 0x9ba1b4 });
    expect(themes.visualAtDistance(0).landTint).not.toBe(0xffffff);
  });

  it("selects data-driven seasons at configured distance boundaries", () => {
    const themes = new ThemeSystem();

    expect(themes.atDistance(0).id).toBe("spring");
    expect(themes.atDistance(ENVIRONMENT.seasonLengthPx - 1).id).toBe("spring");
    expect(themes.atDistance(ENVIRONMENT.seasonLengthPx).id).toBe("summer");
    expect(themes.atDistance(ENVIRONMENT.seasonLengthPx * 2).id).toBe("autumn");
    expect(themes.atDistance(ENVIRONMENT.seasonLengthPx * 3).id).toBe("winter");
    expect(themes.atDistance(ENVIRONMENT.seasonLengthPx * 4).id).toBe("spring");
  });

  it("provides the full visual theme contract without constructing display objects", () => {
    expect(THEMES).toHaveLength(4);
    for (const theme of THEMES) {
      expect(theme).toMatchObject({
        id: expect.any(String),
        skySet: expect.any(String),
        cloudSet: expect.any(String),
        farMountainSet: expect.any(String),
        midgroundSet: expect.any(String),
        decorationSet: expect.any(String),
        groundDecorationSet: expect.any(String),
        allowedWeather: expect.arrayContaining(["sunny"]),
      });
    }
  });

  it("preserves the existing day-phase tint schedule and resets visuals under reduced motion", () => {
    const themes = new ThemeSystem();
    expect(themes.visualAtDistance(0).dayPhase).toBe("morning");
    expect(themes.visualAtDistance(3000).dayPhase).toBe("afternoon");
    expect(themes.visualAtDistance(6000).dayPhase).toBe("sunset");
    expect(themes.visualAtDistance(9000).dayPhase).toBe("night");
    expect(themes.visualAtDistance(12000).theme.id).toBe("summer");
    expect(themes.visualAtDistance(48000).theme.id).toBe("spring");
    expect(themes.visualAtDistance(35000, true)).toMatchObject({ theme: { id: "spring" }, dayPhase: "morning" });
  });

  it("keeps an explicit theme override until it is cleared", () => {
    const themes = new ThemeSystem();
    themes.setTheme("winter");

    expect(themes.atDistance(0).id).toBe("winter");
    themes.setTheme(null);
    expect(themes.atDistance(0).id).toBe("spring");
  });
});
