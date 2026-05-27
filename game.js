const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const confettiCanvas = document.getElementById("confetti");
const confettiCtx = confettiCanvas.getContext("2d");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const finalScoreEl = document.getElementById("finalScore");
const highScoreEl = document.getElementById("highScore");
const highScoreOverlayEl = document.getElementById("highScoreOverlay");
const celebrateEl = document.getElementById("celebrate");
const restartBtn = document.getElementById("restart");
const selfDriveToggle = document.getElementById("selfDrive");
const hideCactusToggle = document.getElementById("hideCactus");

const assets = {
	road: "assets/road.jpg",
	car: "assets/car.png",
	cactus: "assets/cactus.png",
};

const images = {};
let assetsLoaded = 0;
let rotatedRoad = null;

const state = {
	running: false,
	scoreMeters: 0,
	distance: 0,
	lives: 3,
	baseSpeed: 220,
	speed: 220,
	maxSpeed: 520,
	steerSpeed: 260,
	roadOffset: 0,
	spawnTimer: 0,
	spawnInterval: 1.1,
	minSpawnInterval: 0.45,
	cactus: [],
	lastTime: 0,
	frameTime: 0,
	selfDriving: false,
	selfMemory: [],
	selfMemoryMax: 520,
	selfMemorySpeed: 260,
	highScore: 0,
	newHighScore: false,
	confetti: [],
	confettiTimer: 0,
	confettiLoop: false,
	confettiBurstTimer: 0,
	confettiBurstInterval: 0.4,
	hideCactus: false,
	prevCarX: 0,
	car: {
		x: 0,
		y: 0,
		width: 52,
		height: 84,
	},
	mouseX: 0,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const loadHighScore = () => {
	const raw = localStorage.getItem("cargame-high-score");
	const parsed = raw ? Number(raw) : 0;
	return Number.isFinite(parsed) ? parsed : 0;
};

const saveHighScore = (score) => {
	localStorage.setItem("cargame-high-score", String(score));
};

const getRoadBounds = (rect) => {
	const minX = 20;
	const maxX = rect.width - state.car.width - 20;
	return { minX, maxX };
};

const resizeCanvas = () => {
	const rect = canvas.getBoundingClientRect();
	const ratio = window.devicePixelRatio || 1;
	canvas.width = rect.width * ratio;
	canvas.height = rect.height * ratio;
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	confettiCanvas.width = rect.width * ratio;
	confettiCanvas.height = rect.height * ratio;
	confettiCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

	state.car.y = rect.height - state.car.height - 20;
	if (!state.running) {
		drawFrame(0);
	}
};

const loadAssets = () => {
	Object.entries(assets).forEach(([key, src]) => {
		const img = new Image();
		img.onload = () => {
			images[key] = img;
			if (key === "road") {
				rotatedRoad = document.createElement("canvas");
				rotatedRoad.width = img.height;
				rotatedRoad.height = img.width;
				const rctx = rotatedRoad.getContext("2d");
				rctx.translate(rotatedRoad.width / 2, rotatedRoad.height / 2);
				rctx.rotate(-Math.PI / 2);
				rctx.drawImage(
					img,
					-img.width / 2,
					-img.height / 2
				);
			}
			assetsLoaded += 1;
			if (assetsLoaded === Object.keys(assets).length) {
				initGame();
			}
		};
		img.src = src;
	});
};

const resetGame = () => {
	const rect = canvas.getBoundingClientRect();
	state.running = true;
	state.scoreMeters = 0;
	state.distance = 0;
	state.lives = 3;
	state.baseSpeed = 220;
	state.speed = 220;
	state.roadOffset = 0;
	state.spawnTimer = 0;
	state.spawnInterval = 1.1;
	state.minSpawnInterval = 0.45;
	state.cactus = [];
	state.selfDriving = selfDriveToggle.checked;
	state.selfMemory = [];
	state.newHighScore = false;
	state.frameTime = 0;
	state.confetti = [];
	state.confettiTimer = 0;
	state.confettiLoop = false;
	state.confettiBurstTimer = 0;
	state.hideCactus = hideCactusToggle.checked;
	state.car.x = rect.width / 2 - state.car.width / 2;
	state.prevCarX = state.car.x;
	state.car.y = rect.height - state.car.height - 20;
	state.mouseX = rect.width / 2;
	overlayEl.hidden = true;
	updateHud();
};

const showStartScreen = () => {
	state.running = false;
	state.lastTime = 0;
	state.frameTime = 0;
	finalScoreEl.textContent = String(state.scoreMeters);
	highScoreOverlayEl.textContent = String(state.highScore);
	celebrateEl.hidden = true;
	overlayEl.classList.remove("celebrate");
	state.confetti = [];
	state.confettiTimer = 0;
	state.confettiLoop = false;
	state.confettiBurstTimer = 0;
	state.hideCactus = hideCactusToggle.checked;
	overlayTitleEl.textContent = "Start Run";
	restartBtn.textContent = "Start";
	overlayEl.hidden = false;
	state.prevCarX = state.car.x;
	drawFrame(0);
};

const updateHud = () => {
	scoreEl.textContent = String(state.scoreMeters);
	livesEl.textContent = String(state.lives);
	highScoreEl.textContent = String(state.highScore);
};

const spawnConfetti = (rect) => {
	const colors = ["#fff1a8", "#ff9a8b", "#8f6cff", "#7de2ff", "#ffe066"];
	const originX = Math.random() * rect.width;
	const originY = rect.height * (0.15 + Math.random() * 0.45);
	for (let i = 0; i < 140; i += 1) {
		state.confetti.push({
			x: originX + (Math.random() - 0.5) * 160,
			y: originY + (Math.random() - 0.5) * 120,
			vx: (Math.random() - 0.5) * 220,
			vy: -80 - Math.random() * 200,
			rotation: Math.random() * Math.PI,
			spin: (Math.random() - 0.5) * 8,
			size: 6 + Math.random() * 6,
			color: colors[Math.floor(Math.random() * colors.length)],
			life: 1,
		});
	}
};

const updateConfetti = (dt, rect) => {
	if (state.confettiLoop) {
		state.confettiBurstTimer -= dt;
		if (state.confettiBurstTimer <= 0) {
			state.confettiBurstTimer = state.confettiBurstInterval;
			spawnConfetti(rect);
		}
	} else if (state.confettiTimer <= 0) {
		state.confetti = [];
		confettiCtx.clearRect(0, 0, rect.width, rect.height);
		return;
	}

	if (!state.confettiLoop) {
		state.confettiTimer = Math.max(0, state.confettiTimer - dt);
	}
	state.confetti = state.confetti.filter((piece) => piece.life > 0);
	state.confetti.forEach((piece) => {
		piece.vy += 420 * dt;
		piece.x += piece.vx * dt;
		piece.y += piece.vy * dt;
		piece.rotation += piece.spin * dt;
		piece.life -= dt * 0.6;
	});

	confettiCtx.clearRect(0, 0, rect.width, rect.height);
	confettiCtx.save();
	for (const piece of state.confetti) {
		confettiCtx.globalAlpha = Math.max(piece.life, 0);
		confettiCtx.fillStyle = piece.color;
		confettiCtx.translate(piece.x, piece.y);
		confettiCtx.rotate(piece.rotation);
		confettiCtx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
		confettiCtx.setTransform(1, 0, 0, 1, 0, 0);
	}
	confettiCtx.restore();
};

const spawnCactus = () => {
	const rect = canvas.getBoundingClientRect();
	const roadPadding = 36;
	const xMin = roadPadding;
	const xMax = rect.width - roadPadding - 46;
	const x = clamp(Math.random() * rect.width, xMin, xMax);
	state.cactus.push({
		x,
		y: -80,
		width: 46,
		height: 70,
	});
};

const raycastToAabb = (origin, direction, box, maxDistance) => {
	const dx = direction.x;
	const dy = direction.y;
	let tMin = -Infinity;
	let tMax = Infinity;

	if (dx === 0) {
		if (origin.x < box.x || origin.x > box.x + box.width) {
			return null;
		}
	} else {
		const invDx = 1 / dx;
		const t1 = (box.x - origin.x) * invDx;
		const t2 = (box.x + box.width - origin.x) * invDx;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
	}

	if (dy === 0) {
		if (origin.y < box.y || origin.y > box.y + box.height) {
			return null;
		}
	} else {
		const invDy = 1 / dy;
		const t1 = (box.y - origin.y) * invDy;
		const t2 = (box.y + box.height - origin.y) * invDy;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
	}

	if (tMax < tMin || tMax < 0) {
		return null;
	}

	const hitDistance = tMin >= 0 ? tMin : tMax;
	return hitDistance <= maxDistance ? hitDistance : null;
};

const getSensorReadings = (rect) => {
	const origin = {
		x: state.car.x + state.car.width / 2,
		y: state.car.y + 10,
	};
	const maxDistance = 320;
	const directions = [
		{ x: 0, y: -1 },
		{ x: -0.6, y: -1 },
		{ x: 0.6, y: -1 },
	];

	return directions.map((dir) => {
		const length = Math.hypot(dir.x, dir.y);
		const direction = { x: dir.x / length, y: dir.y / length };
		let nearest = maxDistance;
		for (const obstacle of state.cactus) {
			const hit = raycastToAabb(origin, direction, obstacle, maxDistance);
			if (hit !== null && hit < nearest) {
				nearest = hit;
			}
		}
		return { distance: nearest, direction, maxDistance };
	});
};

const getPositionInput = (rect) => {
	const { minX, maxX } = getRoadBounds(rect);
	const t = (state.car.x - minX) / (maxX - minX);
	return clamp(t * 2 - 1, -1, 1);
};

const updateSelfDrivingMemory = (dt, sensors, lateralDelta, forwardDelta) => {
	state.selfMemory = state.selfMemory
		.map((entry) => ({
			x: entry.x - lateralDelta,
			y: entry.y - forwardDelta,
			strength: entry.strength,
		}))
		.filter((entry) => entry.y > -40 && entry.y < state.selfMemoryMax);

	for (const sensor of sensors) {
		if (sensor.distance >= sensor.maxDistance) {
			continue;
		}
		const x = sensor.direction.x * sensor.distance;
		const y = sensor.distance;
		const match = state.selfMemory.find(
			(entry) => Math.abs(entry.x - x) < 30 && Math.abs(entry.y - y) < 60
		);
		if (match) {
			match.x = (match.x + x) / 2;
			match.y = Math.min(match.y, y);
			match.strength = Math.min(match.strength + 0.2, 1);
		} else {
			state.selfMemory.push({ x, y, strength: 0.6 });
		}
	}
};

const updateSelfDriving = (dt, rect) => {
	const sensors = getSensorReadings(rect);
	const position = getPositionInput(rect);

	const avoid = state.selfMemory.reduce(
		(acc, entry) => {
			if (entry.y < 0 || entry.y > 220) {
				return acc;
			}
			const urgency = (1 - entry.y / 220) * entry.strength;
			const direction = entry.x >= 0 ? -1 : 1;
			return acc + direction * urgency;
		},
		0
	);

	const sensorBalance = sensors.reduce((acc, sensor) => {
		return acc + sensor.direction.x * (1 - sensor.distance / sensor.maxDistance);
	}, 0);

	const [front, leftFront, rightFront] = sensors;
	const leftClear = leftFront.distance / leftFront.maxDistance;
	const rightClear = rightFront.distance / rightFront.maxDistance;
	const frontClose = front.distance < 150;
	const wallBias = -position * Math.abs(position);
	const sideTight = leftClear < 0.45 && rightClear < 0.45;

	let steer = avoid * 0.9 + sensorBalance * 0.6 + wallBias * 0.9;
	if (frontClose) {
		const rightScore = rightClear + (position < 0 ? 0.2 : 0);
		const leftScore = leftClear + (position > 0 ? 0.2 : 0);
		steer = rightScore >= leftScore ? 1 : -1;
	} else if (sideTight) {
		steer = clamp(steer - position * 0.9, -1, 1);
	}

	steer = clamp(steer, -1, 1);
	const lateralDelta = steer * state.steerSpeed * dt;
	const forwardDelta = state.speed * dt;
	updateSelfDrivingMemory(dt, sensors, lateralDelta, forwardDelta);
	state.car.x += lateralDelta;
	const { minX, maxX } = getRoadBounds(rect);
	state.car.x = clamp(state.car.x, minX, maxX);
};

const updateManualPerception = (dt, rect, lateralDelta) => {
	const sensors = getSensorReadings(rect);
	updateSelfDrivingMemory(dt, sensors, lateralDelta, state.speed * dt);
};

const drawSensors = (rect) => {
	const sensors = getSensorReadings(rect);
	const origin = {
		x: state.car.x + state.car.width / 2,
		y: state.car.y + 10,
	};

	ctx.save();
	ctx.lineWidth = 2;
	for (const sensor of sensors) {
		const t = clamp(sensor.distance / sensor.maxDistance, 0, 1);
		const r = Math.round(255 * (1 - t));
		const g = Math.round(200 * t + 55);
		ctx.strokeStyle = `rgba(${r}, ${g}, 80, 0.9)`;
		ctx.beginPath();
		ctx.moveTo(origin.x, origin.y);
		ctx.lineTo(
			origin.x + sensor.direction.x * sensor.distance,
			origin.y + sensor.direction.y * sensor.distance
		);
		ctx.stroke();
	}
	ctx.restore();
};

const drawSelfMemory = (rect) => {
	if (!state.selfDriving && !state.hideCactus) {
		return;
	}
	const origin = {
		x: state.car.x + state.car.width / 2,
		y: state.car.y + 10,
	};

	ctx.save();
	ctx.globalCompositeOperation = "screen";
	for (const entry of state.selfMemory) {
		if (entry.y < 0 || entry.y > state.selfMemoryMax) {
			continue;
		}
		const t = clamp(entry.y / state.selfMemoryMax, 0, 1);
		const size = 16 + (1 - t) * 20;
		const x = origin.x + entry.x - size / 2;
		const y = origin.y - entry.y - size / 2;
		const alpha = 0.1 + entry.strength * 0.35;
		ctx.fillStyle = `rgba(120, 220, 255, ${alpha})`;
		ctx.strokeStyle = `rgba(50, 180, 255, ${alpha + 0.15})`;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.roundRect(x, y, size, size, 4);
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
};

const rectsOverlap = (a, b) =>
	a.x < b.x + b.width &&
	a.x + a.width > b.x &&
	a.y < b.y + b.height &&
	a.y + a.height > b.y;

const update = (dt) => {
	const rect = canvas.getBoundingClientRect();

	state.distance += state.speed * dt;
	state.scoreMeters = Math.floor(state.distance / 20);
	updateHud();

	state.speed = clamp(
		state.baseSpeed + state.distance * 0.03,
		state.baseSpeed,
		state.maxSpeed
	);

	state.roadOffset = (state.roadOffset - state.speed * dt) % rect.height;
	state.spawnTimer += dt;

	const targetSpawnInterval = clamp(
		state.spawnInterval - state.distance * 0.00012,
		state.minSpawnInterval,
		state.spawnInterval
	);

	if (state.spawnTimer >= targetSpawnInterval) {
		state.spawnTimer = 0;
		const spawnCount = Math.random() < Math.min(0.35, state.distance / 8000)
			? 2
			: 1;
		for (let i = 0; i < spawnCount; i += 1) {
			spawnCactus();
		}
	}

	state.cactus.forEach((obstacle) => {
		obstacle.y += state.speed * dt;
	});

	state.cactus = state.cactus.filter((obstacle) => obstacle.y < rect.height + 120);

	if (state.selfDriving) {
		updateSelfDriving(dt, rect);
	} else {
		const prevX = state.car.x;
		const targetX = state.mouseX - state.car.width / 2;
		const { minX, maxX } = getRoadBounds(rect);
		state.car.x = clamp(targetX, minX, maxX);
		const lateralDelta = state.car.x - prevX;
		updateManualPerception(dt, rect, lateralDelta);
	}
	state.prevCarX = state.car.x;

	for (let i = state.cactus.length - 1; i >= 0; i -= 1) {
		if (rectsOverlap(state.car, state.cactus[i])) {
			state.cactus.splice(i, 1);
			state.lives -= 1;
			updateHud();
			if (state.lives <= 0) {
				endGame();
				break;
			}
		}
	}
};

const drawBackground = (rect) => {
	if (!images.road || !rotatedRoad) {
		ctx.fillStyle = "#1f2614";
		ctx.fillRect(0, 0, rect.width, rect.height);
		return;
	}

	const img = rotatedRoad;
	const scale = rect.width / img.width;
	const tileHeight = img.height * scale;
	const offset = ((-state.roadOffset % tileHeight) + tileHeight) % tileHeight;
	let y = -tileHeight + offset;

	while (y < rect.height) {
		ctx.drawImage(img, 0, y, rect.width, tileHeight);
		y += tileHeight;
	}
};

const drawCar = () => {
	if (images.car) {
		ctx.drawImage(
			images.car,
			state.car.x,
			state.car.y,
			state.car.width,
			state.car.height
		);
		return;
	}

	ctx.fillStyle = "#d95b43";
	ctx.fillRect(state.car.x, state.car.y, state.car.width, state.car.height);
};

const drawCactus = () => {
	if (state.hideCactus) {
		return;
	}
	state.cactus.forEach((obstacle) => {
		if (images.cactus) {
			ctx.drawImage(
				images.cactus,
				obstacle.x,
				obstacle.y,
				obstacle.width,
				obstacle.height
			);
			return;
		}

		ctx.fillStyle = "#4caf50";
		ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
	});
};

const drawFrame = (timestamp) => {
	const rect = canvas.getBoundingClientRect();
	ctx.clearRect(0, 0, rect.width, rect.height);
	drawBackground(rect);
	drawCactus();
	drawCar();
	drawSelfMemory(rect);
	drawSensors(rect);
	if (!state.frameTime) {
		state.frameTime = timestamp;
	}
	const dt = (timestamp - state.frameTime) / 1000;
	state.frameTime = timestamp;
	updateConfetti(dt, rect);

	if (state.running) {
		if (!state.lastTime) {
			state.lastTime = timestamp;
		}
		const gameDt = (timestamp - state.lastTime) / 1000;
		state.lastTime = timestamp;
		update(gameDt);
	}

	if (state.running || state.confettiTimer > 0 || state.confettiLoop) {
		requestAnimationFrame(drawFrame);
	}
};

const endGame = () => {
	state.running = false;
	state.lastTime = 0;
	state.frameTime = 0;
	finalScoreEl.textContent = String(state.scoreMeters);
	state.newHighScore = state.scoreMeters > state.highScore;
	if (state.newHighScore) {
		state.highScore = state.scoreMeters;
		saveHighScore(state.highScore);
		celebrateEl.hidden = false;
		overlayEl.classList.add("celebrate");
		overlayTitleEl.textContent = "NEW HIGH SCORE!";
		const rect = canvas.getBoundingClientRect();
		state.confetti = [];
		state.confettiTimer = 0;
		state.confettiLoop = true;
		state.confettiBurstTimer = 0;
		spawnConfetti(rect);
	} else {
		celebrateEl.hidden = true;
		overlayEl.classList.remove("celebrate");
		overlayTitleEl.textContent = "Game Over";
		state.confetti = [];
		state.confettiTimer = 0;
		state.confettiLoop = false;
		state.confettiBurstTimer = 0;
	}
	highScoreOverlayEl.textContent = String(state.highScore);
	restartBtn.textContent = "Restart";
	overlayEl.hidden = false;
	if (state.selfDriving) {
		setTimeout(() => {
			if (!state.running) {
				resetGame();
				requestAnimationFrame(drawFrame);
			}
		}, 1000);
	}
};

const initGame = () => {
	resizeCanvas();
	state.highScore = loadHighScore();
	state.scoreMeters = 0;
	state.distance = 0;
	state.lives = 3;
	updateHud();
	showStartScreen();
};

canvas.addEventListener("mousemove", (event) => {
	const rect = canvas.getBoundingClientRect();
	state.mouseX = event.clientX - rect.left;
});

window.addEventListener("resize", resizeCanvas);

restartBtn.addEventListener("click", () => {
	resetGame();
	requestAnimationFrame(drawFrame);
});

selfDriveToggle.addEventListener("change", () => {
	state.selfDriving = selfDriveToggle.checked;
});

hideCactusToggle.addEventListener("change", () => {
	state.hideCactus = hideCactusToggle.checked;
});

loadAssets();
