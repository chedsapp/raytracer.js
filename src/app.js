var fps = document.createElement("div");
fps.innerHTML = "FPS: n/a";
fps.style="position: fixed; left: " + (window.innerHeight-20) + "px; top: 10px;";
document.body.appendChild(fps);
var canvas = document.createElement("canvas");
var gl = canvas.getContext("webgl2");
gl.getExtension('EXT_color_buffer_float')
onerror = function(e) {alert(e)}
var size = 512;
canvas.width = size;
canvas.height = size;
canvas.style = "image-rendering: pixelated;position: fixed; left: 0; top: 0; width: " + (window.innerHeight-30) + "; height: " + (window.innerHeight-30) + "; background: red";
gl.viewport(0, 0, size, size);
document.body.appendChild(canvas);

var res = document.createElement("input");
res.style="position: fixed; left: 0px; top: " + (window.innerHeight-30) + "px; height: 30px; width: " + (window.innerHeight - 120) + "; text-align: center"
res.value = size;
var renderFrame = true;
var mouse = [100, 100, false];
var sensitive = 100.;
canvas.onmousedown = function() {
	var start = [1.-(event.clientX/(sensitive)), 1.-(event.clientY/(sensitive))];
	var ps = [camDir[0], camDir[1]]
	canvas.onmousemove = function() {
		mouse[0] = 1.-(event.clientX/(sensitive));
		mouse[1] = 1.-((event.clientY/(sensitive)));
		mouse[2] = true;
		
		
		camDir = [ps[0] + (start[0]-mouse[0]), ps[1] + (start[1]-mouse[1])];
		
		renderFrame = true;
	}
	canvas.onmouseup = function() {
		canvas.onmousemove = null;
		mouse[0] = 1.-(event.clientX/(sensitive));
		mouse[1] = 1.-((event.clientY/(sensitive)));
		mouse[2] = true;
		
		
		camDir = [ps[0] + (start[0]-mouse[0]), ps[1] + (start[1]-mouse[1])];
		
		mouse[2] = false;
	}
}
res.onkeydown = function() {
	if (event.key == "Enter") {
		var old = size;
		size = Number(this.value);
		
		mouse[0] = size*(mouse[0]/old)
		mouse[1] = size*(mouse[1]/old)
		
		gl.viewport(0, 0, size, size);
		canvas.width = size;
		canvas.height = size;
		renderFrame = true;
		Object.values(passes).forEach(function(e) {
			gl.bindTexture(gl.TEXTURE_2D, e.texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
			
		})
	}
}
document.body.appendChild(res);
var playing = false;
var playButton = document.createElement("button");
playButton.style="position: fixed; top: " + (window.innerHeight-30) + "px; left: " + (window.innerHeight - 120) + "px; width: 90px; height: 30px";
document.body.appendChild(playButton);
playButton.innerHTML = "Play";
playButton.onmousedown = function() {
	this.innerHTML = this.innerHTML=="Play"?"Pause":"Play";
	playing = !playing;//this.innerHTML=="Play";
}
function shader(src) {
	function createShader(s, type) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, s);
		gl.compileShader(shader, gl.COMPILE_STATUS);
		if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
		alert(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return false;
	}
	
	var vshader = createShader(`#version 300 es
	precision highp float;
	in vec2 p;
	void main() {
		gl_Position = vec4(p, 1, 1);
	}`, gl.VERTEX_SHADER);
	
	var fshader = createShader(`#version 300 es
	precision highp float;
	out vec4 fragColor;
	` + src, gl.FRAGMENT_SHADER);
	
	var program = gl.createProgram();
	gl.attachShader(program, vshader);
	gl.attachShader(program, fshader);
	gl.linkProgram(program);
	gl.useProgram(program);
	
	var ploc = gl.getAttribLocation(program, "p");
	var buf =  gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, 1, 1, -1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
	
	var vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	gl.enableVertexAttribArray(ploc);
	gl.vertexAttribPointer(ploc, 2, gl.FLOAT, false, 0, 0);
	
	return program;
}

function createTexture() {
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
    	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP);
    	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.C);
    	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	return texture;
}























var passes = {
	pass: {
		shader: shader(`
		uniform float iTime;
		uniform vec2 iResolution;
		uniform vec3 camPos;
		uniform vec3 camDir;
		uniform int flip;
		uniform int sup;
		uniform sampler2D input0;
#define PI 3.141592653
const float maxD = 1000000.;
float hash13(vec3 p3)
{
    p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float sphere(in vec3 ro, in vec3 rd, in float r) {
    float d = -dot(ro, rd);
    float disc = r*r-dot(ro, ro)+d*d;
    if (disc < 0.0) return maxD;
    d -= sqrt(disc);
    if (d > 0.0) return d;
    return maxD;
}
#define S(center, radius, col, mt) tmp = sphere(ro-center, rd, radius); if (tmp < d) {mat = mt;color = col;d = tmp; n=(((ro+rd*tmp)-center)/radius);}; 
#define P(center, axis, f, col, mt) tmp = -(ro.axis-center.axis)/rd.axis; if (tmp >= 0.0 && tmp < d) {vec3 p = ro+rd*tmp; if ((f)) {mat = mt; color = col; d = tmp; n = vec3(0); n.axis = -sign(rd.axis);}}; 
struct hit {
    float d;
    vec3 n;
    vec3 color;
    int mat;
};
vec3 hash33(vec3 p3)
{ //by Dave_Hoskins https://www.shadertoy.com/view/4djSRW
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}
hit scene(in vec3 ro, in vec3 rd) {
    vec3 n;
    float d = maxD;
    float tmp;
    vec3 color;
    int mat = 0;
    P(vec3(0.0, 0.0, -2.0), z, max(abs(p.x), abs(p.y)) < 2.0, vec3(0.5), 2)
    P(vec3(0.0, 0.0, 2.0), z, max(abs(p.x), abs(p.y)) < 2.0, vec3(1.0, 0.25, 0.25), 1)
    P(vec3(0.0, -2.0, 0.0), y, max(abs(p.x), abs(p.z)) < 2.0, vec3(0.5), 2)
    P(vec3(0.0, 2.0, 0.0), y, max(abs(p.x), abs(p.z)) < 2.0, vec3(0.5), 2)
    P(vec3(-2.0, 0.0, 0.0), x, max(abs(p.z), abs(p.y)) < 2.0, vec3(0.5), 2)
    P(vec3(2.0, 0.0, 0.0), x, max(abs(p.z), abs(p.y)) < 2.0, (int(floor(p.y*2.0))+int(floor(p.z*2.0)))%2==0?vec3(hash33(floor(vec3(p.zy*2., 0.0))*100.).xy, 1):vec3(0.5), (int(floor(p.y*2.0))+int(floor(p.z*2.0)))%2==0?1:2)
    S(vec3(0, -1.0, -1.5), 0.5, vec3(0.5), 0);
    S(vec3(0, 0, -1.5), 0.5, vec3(0.5), 0);
    S(vec3(0, 1.0, -1.5), 0.5, vec3(0.5), 0);
    return hit(d, n, color, mat);
}
vec3 rus(in vec3 seed) {
    return normalize(hash33(seed)-0.5);
}
const int ss = 1;
vec3 ref(in vec3 rd, in vec3 h, in vec3 ro, in vec3 seed) {
    float w = hash13(seed*10.)*0.25;
    return mix(reflect(rd, h), normalize(h+rus(seed)), w);
}
vec3 dif(in vec3 rd, in vec3 h, in vec3 ro) {
    return normalize(h+rus(vec3(rd*523.23523+iTime*100.)));
}
vec3 getColor(in vec3 ro, in vec3 rd, in vec3 seed) {
    vec3 c = vec3(2.0);
    vec3 on;
    for (int i = 0; i < 50; i += 1) {
        float v = 1.0;
        hit h = scene(ro, rd);
        if (h.d >= maxD) {c *= 1.0; break;};
        ro = ro+rd*(h.d-0.0001);
        if (h.mat == 0) rd = ref(rd, h.n, ro, seed);
        if (h.mat == 1) {c *= h.color; break;}
        if (h.mat == 2) rd = dif(rd, h.n, ro);
        c*= h.color;
    }
    return c;//scene(ro, rd).d < 100.?vec3(0):vec3(1);
}
vec2 hash23(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);
}

vec3 image(in vec2 fragCoord) {
	vec2 s = sup == 0?vec2(0):hash23(vec3(fragCoord.xy, iTime));
	vec2 uv = ((fragCoord.xy+s)/iResolution.xy)-0.5;
	//vec2 mouse = (iMouse.xy/iResolution.xy)*vec2(PI*2.0, PI);
	vec3 ro = camPos;//vec3(sin(mouse.x)*sin(mouse.y), cos(mouse.x)*sin(mouse.y), cos(mouse.y))*2.0;
	vec3 rd = camDir;
	if (flip > 0) uv = -uv;
	vec3 px = vec3(normalize(vec2(rd.y, -rd.x)), 0);//(vec3(normalize(vec2(rd.y, -rd.x)), 0.0));
	vec3 py = cross(px, rd);
	rd = normalize(rd+px*uv.x+py*uv.y);
	return getColor(ro, rd, vec3(uv.xy, iTime)*100.);
}
const int tileSize = 512;

void main() {
	if (sup != 0) {
		vec4 c = texelFetch(input0, ivec2(gl_FragCoord.xy), 0);
		if (c.w == 0.0) c = vec4(0);
		ivec2 fc = ivec2(gl_FragCoord.xy);
		ivec2 tile = fc/tileSize;
		int tileID = tile.x+(tile.y*(int(iResolution.x)/tileSize));
		int size = int(iResolution.x)/tileSize;
		if (tileID != (int(iTime*0.0005)%(size*size))) {
			fragColor = texelFetch(input0, ivec2(gl_FragCoord.xy), 0);
			return;
		}
		vec4 col = vec4(image(gl_FragCoord.xy), 1);
		fragColor = c + col;
	} else {
		vec3 col = image(gl_FragCoord.xy);
		fragColor = vec4(col, 0.0);
	}
}


		`),
		inputs: ["pass1"]
	},
	pass1: {
		shader: shader(`
		uniform sampler2D input0;
		uniform float iTime;
		vec2 hash23(vec3 p3)
		{
		    p3 = fract(p3 * vec3(.1031, .1030, .0973));
		    p3 += dot(p3, p3.yzx+33.33);
		    return fract((p3.xx+p3.yz)*p3.zy);
		}
		void main() {
			vec2 r = hash23(vec3(gl_FragCoord.xy, iTime*10.))-0.5;
			fragColor = texelFetch(input0, ivec2(gl_FragCoord), 0);
			//r *= 50./(fragColor.w);
			//vec4 p2 = texelFetch(input0, ivec2(gl_FragCoord.xy+r), 0);
			//p2.xyz = pow(p2.xyz, vec3(2))*0.2;
			//fragColor = mix(fragColor, p2, 0.5);
			//fragColor += texelFetch(input0, ivec2(gl_FragCoord+hash23(vec3(gl_FragCoord.xy, iTime))), 0);
		}
		`),
		inputs: ["pass"]
	},
	main: {
		shader: shader(`
		uniform sampler2D input0;
		void main() {
			fragColor = texelFetch(input0, ivec2(gl_FragCoord), 0);
			if (fragColor.w != 0.0) fragColor.xyz /= fragColor.w;
			fragColor.xyz = 1.-exp(-fragColor.xyz*2.0);
			fragColor.w = 1.;
		}
		`),
		inputs: ["pass"]
	}
};	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
var sup = false;
function setUniforms(locs) {
	gl.uniform1f(locs["iTime"], frame);
	gl.uniform2fv(locs["iResolution"], [size, size]);
	gl.uniform1i(locs["flip"], flip);
	gl.uniform1i(locs["sup"], sup);
	gl.uniform3fv(locs["camPos"], camPos);
	gl.uniform3fv(locs["camDir"], camNorm);
}
function init() {
	Object.keys(passes).forEach(function(e) {
		var program = (passes[e].shader);
		gl.useProgram(program);
		if (e != "main") {
			var texture = createTexture();
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
			var fb = gl.createFramebuffer();
			passes[e].framebuffer = fb;
			passes[e].texture = texture;
			gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		}
		var inputs = passes[e].inputs;
		passes[e].locs = {};
		for (var i = 0; i < inputs.length; i += 1) {
			var name = "input" + i;  //name of the texture in shader
			var loc = gl.getUniformLocation(program, name); //location of texture in shader
			gl.uniform1i(loc, i);
			passes[e].locs[name] = loc;
		}
		passes[e].uniforms = {
			iTime: gl.getUniformLocation(program, "iTime"),
			iResolution: gl.getUniformLocation(program, "iResolution"),
			flip: gl.getUniformLocation(program, "flip"),
			camPos: gl.getUniformLocation(program, "camPos"),
			camDir: gl.getUniformLocation(program, "camDir"),
			sup: gl.getUniformLocation(program, "sup")
		}
		if (e == "main") {
			passes[e].render = function() {
				for (var i = 0; i < this.inputs.length; i += 1) {
					var ipass = passes[this.inputs[i]];
					gl.activeTexture(gl.TEXTURE0 + i);
					gl.bindTexture(gl.TEXTURE_2D, ipass.texture);
				}
				
				gl.useProgram(this.shader);
				setUniforms(this.uniforms);
				gl.drawArrays(gl.TRIANGLES, 0, 6);
			}
		} else {
			passes[e].render = function() {
				for (var i = 0; i < this.inputs.length; i += 1) {
					var ipass = passes[this.inputs[i]];
					gl.activeTexture(gl.TEXTURE0 + i);
					gl.bindTexture(gl.TEXTURE_2D, ipass.texture);
				}
				gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
				gl.useProgram(this.shader);
				setUniforms(this.uniforms);
				gl.drawArrays(gl.TRIANGLES, 0, 6);
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			}
		}
	})
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
init();
var frame = 0;
var keys = {};
window.onkeydown = function() {
	if (event.key == "k") {
		document.write([camPos, camDir, camNorm]);
	}
	if (event.key == "ArrowUp") {
		speed *= 2.0;
	}
	if (event.key == "ArrowDown") {
		speed *= 0.5;
	}
	if (event.key == "m") {
		sup = !sup;
		frame = 0;
	}
	keys[event.key.toUpperCase()] = true;
}
window.onkeyup = function() {
	delete keys[event.key.toUpperCase()]
}
var camPos = [1.98247874117497,-1.9197204170588478,-1.7898010291167805];
var camDir = [-0.9099999999999993,1.48075];
var camNorm = [0, 0, 0]
var speed = 0.1;
function cross(a, b) {
	return [a[1] * b[2] - a[2] * b[1], 
	        a[2] * b[0] - a[0] * b[2], 
	        a[0] * b[1] - a[1] * b[0]]
}
function normalize(a) {
	var l = Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
	return [a[0]/l, a[1]/l, a[2]/l];
}
var flip;
var frames = 0;
var start = Date.now();
function loop() {
	if (Date.now()-start > 1000) {
		fps.innerHTML = "fps: " + Math.floor(frames);
		frames = 0;
		start = Date.now();
	}
	var cd = [camDir[0], camDir[1]];
	flip = Math.abs(Math.floor((cd[1]/Math.PI) + 1))%2 < 1;
	var normal = normalize([Math.sin(cd[0])*Math.sin(cd[1]),Math.cos(cd[0])*Math.sin(cd[1]),Math.cos (cd[1])]);
	var side = normalize(cross(normal, [0, 0, 1]));
	camNorm = normal;
	var movement = [0, 0, 0];
	if (keys["W"]) {
		movement[0] += normal[0];
		movement[1] += normal[1];
		movement[2] += normal[2];
		renderFrame = true;
	}
	if (keys["S"]) {
		movement[0] -= normal[0];
		movement[1] -= normal[1];
		movement[2] -= normal[2];
		renderFrame = true;
	}
	
	if (keys["D"] && side) {
		movement[0] += side[0];
		movement[1] += side[1];
		movement[2] += side[2];
		renderFrame = true;
	}
	if (keys["A"] && side) {
		movement[0] -= side[0];
		movement[1] -= side[1];
		movement[2] -= side[2];
		renderFrame = true;
	}
	if (keys["SHIFT"]) {
		movement[2] -= 1;
		renderFrame = true;
	}
	if (keys[" "]) {
		movement[2] += 1;
		renderFrame = true;
	}
	movement = normalize(movement);
	if (!(Number.isNaN(movement[0]) || Number.isNaN(movement[1]) || Number.isNaN(movement[2]))) {
		camPos[0] += movement[0]*speed;
		camPos[1] += movement[1]*speed;
		camPos[2] += movement[2]*speed;
	}
	if (playing || frame == 0 || renderFrame) {
		Object.keys(passes).forEach(function(e) {
			var pass = passes[e];
			pass.render();
		})
		frame += 1;
		renderFrame = false;
	}
	frames += 1;
	window.requestAnimationFrame(loop);
}
loop();
