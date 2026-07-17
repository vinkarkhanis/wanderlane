# Slow Roads+

A calm infinite-driving game (Three.js) with day/night and multiple terrains.

## Run
```
python -m http.server 8123
```
Open http://localhost:8123/index.html

## Controls
- W/↑ accelerate · S/↓ brake · A/D (←/→) steer
- T day/night · R terrain · C camera · Space auto-drive · V car color

## Structure
```
index.html        markup + import map, loads src/main.js
styles.css        UI styling
src/
  main.js         orchestrator + render loop
  config.js       terrain palettes, road + physics constants
  heightfield.js  shared elevation function
  road.js         winding road, lane lines, guardrail
  terrain.js      ground mesh + distant hills
  scenery.js      instanced grass, trees, rocks
  car.js          coupe model
  vehicle.js      free-driving physics (user-controlled steering)
  environment.js  sky dome + lights + day/night
  camera.js       chase/hood cameras
  controls.js     keyboard + button input
```
