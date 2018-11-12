/*	__________

	Data Types
	__________

*/
function Point(x, y, id) {
	this.x = x;
	this.y = y;
	this.ID = id;
}

function Point_cloud(name, points) {
	this.Name = name;
	this.points = resample(points, num_points);
	this.points = scale(this.points);
	this.points = translate_to(this.points, origin);
}

function Result(name, score, ms) {
	this.Name = name;
	this.score = score;
	this.time = ms;
}


/*	_______________________

	PDollarRecognizer class
	_______________________

*/

//globals
const num_point_clouds = 3;
const num_points = 32;
const origin = new Point(0, 0, 0);

function PDollarRecognizer() {
	// collection of templates
	this.point_clouds = new Array(num_point_clouds); // where all templates will be stored

	this.point_clouds[0] = new Point_cloud("T", new Array(
		new Point(30, 7, 1), new Point(103, 7, 1),
		new Point(66, 7, 2), new Point(66, 87, 2)));
	this.point_clouds[1] = new Point_cloud("N", new Array(
		new Point(177,92,1),new Point(177,2,1),
		new Point(182,1,2),new Point(246,95,2),
		new Point(247,87,3),new Point(247,1,3)
	));
	this.point_clouds[2] = new Point_cloud("D", new Array(
		new Point(345,9,1),new Point(345,87,1),
		new Point(351,8,2),new Point(363,8,2),new Point(372,9,2),new Point(380,11,2),new Point(386,14,2),new Point(391,17,2),new Point(394,22,2),new Point(397,28,2),new Point(399,34,2),new Point(400,42,2),new Point(400,50,2),new Point(400,56,2),new Point(399,61,2),new Point(397,66,2),new Point(394,70,2),new Point(391,74,2),new Point(386,78,2),new Point(382,81,2),new Point(377,83,2),new Point(372,85,2),new Point(367,87,2),new Point(360,87,2),new Point(355,88,2),new Point(349,87,2)
	));

	// match points against a set of templates by using NNK. Returns a score (0, 1), 1 = perfect match
	this.recognize = function(points) {
		console.log("p_length: "+points.length);
		var t_ini = Date.now();

		// normalizing point_cloud, points, figure
		points = resample(points, num_points); 
		points = scale(points); // get proper scale for stroke
		points = translate_to(points, origin);

		var score = +Infinity;
		var template_n = -1;
		for(var c = 0; c < this.point_clouds.length; c++) { // for each template
			// normalizing template
			var dist = greedy_cloud_match(points, this.point_clouds[c]);
			if(dist < score) {
				score = dist;
				template_n = c;
			}
		}
		console.log("score: "+score);
		var t_fin = Date.now();
		return (template_n == -1) ? new Result("no match", 0.0, t_fin - t_ini)
			   : new Result(this.point_clouds[template_n].Name, Math.max((score - 2.0) / -2.0, 0.0), t_fin - t_ini);
	}
}
// this.add_gesture = funtion(name, points)
// this.delete_gesture = function()


/*	________________________________

	POINT_CLOUD MANAGEMENT FUNCTIONS
	________________________________

	(points = pc = point_cloud = a collection of points = our stroke)
*/


// match two point_cloud by calculating distance between their points
// between our points and the template
function greedy_cloud_match(points, pc) {
	var e = 0.50;
	var step = Math.floor(Math.pow(points.length, 1.0 - e));
	var min = +Infinity;
	for(var c = 0; c < points.length; c += step) {
		var d1 = cloud_distance(points, pc.points, c);
		var d2 = cloud_distance(pc.points, points, c);
		min = Math.min(min, Math.min(d1, d2));
	}

	return min;
}

// geometric distance between two point_clouds
function cloud_distance(pc1, pc2, start) {
	var aux = new Array(pc1.length);
	for(var c = 0; c < pc1.length; c++) {
		aux[c] = false;
	}

	var suma = 0;
	var w = start;
	do {
		var index = -1;
		var min = +Infinity;
		for(var j = 0; j < aux.length; j++) {
			if(!aux[j]) {
				var dist = distance(pc1[w], pc2[j]);
				//console.log("dist:: "+dist);
				if(dist < min) {
					min = dist;
					index = j;
				}
			}
		} // index is the pos in which less distance between the two pc is
		aux[index] = true;
		var weigth = 1 - ((w - start + pc1.length) % pc1.length) / pc1.length;
		suma += weigth * min;
		w = (w + 1) % pc1.length;
	} while(w != start);

	return suma;
}

// resamples a pc in order to set homogenous lengths for compare them properly.
// resample_length indicates the length which to resample the pc.
function resample(points, resample_length) {
	var interval = path_length(points) / (resample_length - 1);
	console.log("interval: "+interval);
	var D = 0.0; // no sé que coño es esto
	var new_points = new Array(points[0]);
	for (var c = 1; c < points.length; c++) { // for each point in points
		if(points[c].ID == points[c - 1].ID) {
			var dist = distance(points[c - 1], points[c]);
			if(D + dist >= interval) {
				var px = points[c - 1].x + ((interval - D) / dist) * (points[c].x - points[c - 1].x);
				var py = points[c - 1].y + ((interval - D) / dist) * (points[c].y - points[c - 1].y);
				var p = new Point(px, py, points[c].ID);
				new_points[new_points.length] = p; // add new point
				points.splice(c, 0, p); // insert p into points; p will be the next c
				D = 0.0;
			}
			else D += dist;
		}
	}
	// sometimes there's errors in the last point, so we duplicate it
	if(new_points.length == resample_length - 1) { 
		new_points[new_points.length] = new Point(points[points.length - 1].x,
			                                      points[points.length - 1].y,
			                                      points[points.length - 1].ID);
	}

	return new_points;
}

// provides same point_cloud in different scales in order to compare
function scale(points) {
	var min_x = +Infinity, max_x = -Infinity, min_y = +Infinity, max_y = -Infinity;
	for(var c = 0; c < points.length; c++) {
		min_x = Math.min(min_x, points[c].x);
		min_y = Math.min(min_y, points[c].y);
		max_x = Math.max(max_x, points[c].x);
		max_y = Math.max(max_y, points[c].y);
	}

	var scale = Math.max(max_x - min_x, max_y - min_y);
	var new_points = new Array();
	for(var c = 0; c < points.length; c++) {
		var px = (points[c].x - min_x) / scale;
		var py = (points[c].y - min_y) / scale;
		new_points[new_points.length] = new Point(px, py, points[c].ID);
	}

	return new_points;
}

// translates a point_cloud to the provided centroid. It maps all pc to origin, 
// in order to recognize pc that are similar but in different coordinates
function translate_to(points, where) {
	var centroid = get_centroid(points);
	var new_points = new Array();
	for(var c = 0; c < points.length; c++) {
		var px = points[c].x + where.x - centroid.x;
		var py = points[c].y + where.y - centroid.y;
		new_points[new_points.length] = new Point(px, py, points[c].ID);
	}

	return new_points;
}

// calculates the centroid of given cloud of points
function get_centroid(points) {
	var x = 0.0, y = 0.0;
	for(var c = 0; c < points.length; c++) {
		x += points[c].x;
		y += points[c].y;
	}
	x /= points.length;
	y /= points.length;
	return new Point(x, y, 0);
}

// calculates the length of a single point in a point_cloud
function path_length(points) {
	var dist = 0.0;
	console.log(points.length);
	for(var c = 1; c < points.length; c++) {
		if(points[c].ID == points[c - 1].ID) {
			dist += distance(points[c - 1], points[c]);
		}
	}

	return dist;
}

// calculates distance between two given points
function distance(p1, p2) {
	dx = p2.x - p1.x; dy = p2.y - p1.y;
	return Math.sqrt(dx * dx + dy * dy);
	//return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}