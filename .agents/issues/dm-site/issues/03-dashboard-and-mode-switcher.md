# 03: Dashboard and Mode switcher

**What to build:** The Dashboard as the main screen of a Campaign, with buttons and keyboard shortcuts to switch between the four Modes (Combat, Exploration/Travel, Social/Roleplay, Prep). Each Mode is a layout of panels; the panel framework is introduced here. Modes other than Prep may show placeholder layouts. The last Mode is remembered per Campaign.

**Blocked by:** 01 Scaffold and Campaign picker

**Status:** ready-for-agent

- [ ] Dashboard is the landing screen of an opened Campaign
- [ ] Clicking a Mode button switches layout
- [ ] Keyboard shortcuts switch Mode and a way back to the Dashboard exists
- [ ] Last Mode per Campaign is remembered across reload
- [ ] Panels are reusable units that a Mode lays out (so later tickets add panels, not screens)
