document.addEventListener("DOMContentLoaded", function() {
	demo.init();
	window.addEventListener('resize', demo.resize);
});

var demo = {
	// CUSTOMIZABLE PROPERTIES
	// - physics speed multiplier: allows slowing down or speeding up simulation
	speed: 1,
	// - color of particles
	color: {
		r: '80',
		g: '175',
		b: '255',
		a: '0.5'
	},
	
	// END CUSTOMIZATION
	// whether demo is running
	started: false,
	// canvas and associated context references
	canvas: null,
	ctx: null,
	// viewport dimensions (DIPs)
	width: 0,
	height: 0,
	// devicePixelRatio alias (should only be used for rendering, physics shouldn't care)
	dpr: window.devicePixelRatio || 1,
	// time since last drop
	drop_time: 0,
	// ideal time between drops (changed with mouse/finger)
	drop_delay: 25,
	// wind applied to rain (changed with mouse/finger)
	wind: 4,
	// color of rain (set in init)
	rain_color: null,
	rain_color_clear: null,
	// rain particles
	rain: [],
	rain_pool: [],
	// rain droplet (splash) particles
	drops: [],
	drop_pool: []
};

// demo initialization (should only run once)
demo.init = function() {
	if (!demo.started) {
		demo.started = true;
		demo.canvas = document.getElementById('canvas');
		demo.ctx = demo.canvas.getContext('2d');
		var c = demo.color;
		demo.rain_color = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + c.a + ')';
		demo.rain_color_clear = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)';
		demo.resize();
		Ticker.addListener(demo.step);
		
		// 
		const gui = new dat.GUI();
		gui.add(demo, 'speed', 0.2, 2);
		
		// fade out instructions after a few seconds
		var instructions = document.getElementById('instructions');
		setTimeout(function() {
			instructions.style.opacity = 0;
			setTimeout(function(){
				instructions.parentNode.removeChild(instructions);
			}, 2000);
		}, 4000);
	}
}

// (re)size canvas (clears all particles)
demo.resize = function() {
	// localize common references
	var rain = demo.rain;
	var drops = demo.drops;
	// recycle particles
	for (var i = rain.length - 1; i >= 0; i--) {
			rain.pop().recycle();
	}
	for (var i = drops.length - 1; i >= 0; i--) {
			drops.pop().recycle();
	}
	// resize
	demo.width = window.innerWidth;
	demo.height = window.innerHeight;
	demo.canvas.width = demo.width * demo.dpr;
	demo.canvas.height = demo.height * demo.dpr;
}

demo.step = function(time, lag) {
	// localize common references
	var demo = window.demo;
	var speed = demo.speed;
	var width = demo.width;
	var height = demo.height;
	var wind = demo.wind;
	var rain = demo.rain;
	var rain_pool = demo.rain_pool;
	var drops = demo.drops;
	var drop_pool = demo.drop_pool;
	
	// multiplier for physics
	var multiplier = speed * lag;
	
	// spawn drops
	demo.drop_time += time * speed;
	while (demo.drop_time > demo.drop_delay) {
		demo.drop_time -= demo.drop_delay;
		var new_rain = rain_pool.pop() || new Rain();
		new_rain.init();
		var wind_expand = Math.abs(height / new_rain.speed * wind); // expand spawn width as wind increases
		var spawn_x = Math.random() * (width + wind_expand);
		if (wind > 0) spawn_x -= wind_expand;
		new_rain.x = spawn_x;
		rain.push(new_rain);
	}
	
	// rain physics
	for (var i = rain.length - 1; i >= 0; i--) {
		var r = rain[i];
		r.y += r.speed * r.z * multiplier;
		r.x += r.z * wind * multiplier;
		// remove rain when out of view
		if (r.y > height) {
			// if rain reached bottom of view, show a splash
			r.splash();
		}
		// recycle rain
		if (r.y > height + Rain.height * r.z || (wind < 0 && r.x < wind) || (wind > 0 && r.x > width + wind)) {
			r.recycle();
			rain.splice(i, 1);
		}
	}
	
	// splash drop physics
	var drop_max_speed = Drop.max_speed;
	for (var i = drops.length - 1; i >= 0; i--) {
		var d = drops[i];
		d.x += d.speed_x * multiplier;
		d.y += d.speed_y * multiplier;
		// apply gravity - magic number 0.3 represents a faked gravity constant
		d.speed_y += 0.3 * multiplier;
		// apply wind (but scale back the force)
		d.speed_x += wind / 25 * multiplier;
		if (d.speed_x < -drop_max_speed) {
			d.speed_x = -drop_max_speed;
		}else if (d.speed_x > drop_max_speed) {
			d.speed_x = drop_max_speed;
		}
		// recycle
		if (d.y > height + d.radius) {
			d.recycle();
			drops.splice(i, 1);
		}
	}
	
	demo.draw();
}

demo.draw = function() {
	// localize common references
	var demo = window.demo;
	var width = demo.width;
	var height = demo.height;
	var dpr = demo.dpr;
	var rain = demo.rain;
	var drops = demo.drops;
	var ctx = demo.ctx;
	
	// start fresh
	ctx.clearRect(0, 0, width*dpr, height*dpr);
	
	// draw rain (trace all paths first, then stroke once)
	ctx.beginPath();
	var rain_height = Rain.height * dpr;
	for (var i = rain.length - 1; i >= 0; i--) {
		var r = rain[i];
		var real_x = r.x * dpr;
		var real_y = r.y * dpr;
		ctx.moveTo(real_x, real_y);
		// magic number 1.5 compensates for lack of trig in drawing angled rain
		ctx.lineTo(real_x - demo.wind * r.z * dpr * 1.5, real_y - rain_height * r.z);
	}
	ctx.lineWidth = Rain.width * dpr;
	ctx.strokeStyle = demo.rain_color;
	ctx.stroke();
	
	// draw splash drops (just copy pre-rendered canvas)
	for (var i = drops.length - 1; i >= 0; i--) {
		var d = drops[i];
		var real_x = d.x * dpr - d.radius;
		var real_y = d.y * dpr - d.radius;
		ctx.drawImage(d.canvas, real_x, real_y);
	}
}

