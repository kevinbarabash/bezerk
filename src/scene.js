// types of objects:
// - paths
// - groups

const identity = [1, 0, 0, 1, 0, 0];


// order is paint order
const scene = {
    children: [],
    transform: identity,
};

const model = {
    type: 'PATH',   // use enums?
    data: [
        {
            point: [100, 100],
            control1: null,
            control2: null,
        },
        {
            point: [200, 100],
            control1: null,
            control2: null,
        },
        {
            point: [200, 200],
            control1: [100, 200],
            control2: [300, 200],
        },
        {
            point: [300, 300],
            control1: [200, 300],
            control2: [400, 300],
        },
        {
            point: [400, 400],
            control1: [300, 400],
            control2: [300, 400],
        },
    ],
};

// SVG utils

const concat = (array) => array.reduce((result, item) => `${result}${item}`, '');
const flatten = (array) => array.reduce(
    (result, item) => result.concat(Array.isArray(item) ? flatten(item) : item),
    []
);
const sum = (array) => array.reduce((result, item) => result + item, 0);
const average = (array) => sum(array) / array.length;

const getPoints = (model) => {
    const result = [];
    model.data.forEach((part) => {
        result.push(part.point);
        if (part.control1) {
            result.push(part.control1);
        }
        if (part.control2) {
            result.push(part.control2);
        }
    });
    return result;
};

const getLines = (model) => {
    const lines = [];
    for (const part of model.data) {
        if (part.control1) {
            lines.push([part.point, part.control1]);
        }
        if (part.control2) {
            lines.push([part.point, part.control2]);
        }
    }
    return lines;
};

const setAttributes = (elem, attributes) => {
    for (const [name, value] of Object.entries(attributes)) {
        elem.setAttribute(name, value);
    }
};

const dString = (model) => {
    let part, prev, result;

    part = model.data[0];
    result = `M${part.point.join(',')}`;
    for (let i = 1; i < model.data.length; i++) {
        prev = part;
        part = model.data[i];

        if (prev.control2 && part.control1) {
            result += `C${prev.control2.join(',')},${part.control1.join(',')},${part.point.join(',')}`;
        } else if (!prev.control2 && part.control1) {
            result += `C${prev.point.join(',')},${part.control1.join(',')},${part.point.join(',')}`;
        } else if (!prev.control2 && !part.control1) {
            result += `L${part.point.join(',')}`;
        } else {
            throw new Error('foobar');
        }
    }

    return result;
};

// returns a <path> element
const createPath = (model) => {
    const elem = document.createElementNS(ns, 'path');

    setAttributes(elem, {
        'd': dString(model),
        'stroke': 'blue',
        'stroke-width': '5',
        'fill': 'none',
    });

    return elem;
};

const createCircle = (point, radius = 8) => {
    const elem = document.createElementNS(ns, 'circle');

    setAttributes(elem, {
        'cx': point[0],
        'cy': point[1],
        'r': radius,
        'fill': 'white',
        'stroke': 'black',
        'stroke-width': '2',
    });

    return elem;
};

const createLine = (line) => {
    const elem = document.createElementNS(ns, 'line');

    setAttributes(elem, {
        'x1': line[0][0],
        'y1': line[0][1],
        'x2': line[1][0],
        'y2': line[1][1],
        'stroke': 'black',
        'stroke-width': '2',
    });

    return elem;
};

const updatePath = (elem, model) => {
    const d = dString(model);
    setAttributes(elem, {
        'd': d,
        'stroke': 'blue',
        'stroke-width': '5',
        'fill': 'none',
    });
};


const ns = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(ns, 'svg');

const width = 512;
const height = 512;

svg.setAttribute('width', `${width}`);
svg.setAttribute('height', `${height}`);
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

const drawingLayer = document.createElementNS(ns, 'g');
const overlayLayer = document.createElementNS(ns, 'g');

// TODO: describe the translate and scale as a single matrix operation
drawingLayer.setAttribute('transform', `translate(0,${height}) scale(1,-1)`);
overlayLayer.setAttribute('transform', `translate(0,${height}) scale(1,-1)`);

const pathElem = createPath(model);
drawingLayer.appendChild(pathElem);

getLines(model).forEach((line) => overlayLayer.appendChild(createLine(line)));
getPoints(model).forEach((point) => overlayLayer.appendChild(createCircle(point)));


svg.appendChild(drawingLayer);
svg.appendChild(overlayLayer);

document.body.appendChild(svg);

const bounds = svg.getBoundingClientRect();
const offset = [bounds.left, bounds.top];

// TODO: reuse the matrix operation to transform event locations
const eventToPoint = (e) => [e.pageX - offset[0], bounds.height - (e.pageY - offset[1])];

const downs = Kefir.fromEvents(document, 'mousedown', eventToPoint);
const moves = Kefir.fromEvents(document, 'mousemove', eventToPoint);
const ups = Kefir.fromEvents(document, 'mouseup', eventToPoint);

const drags = downs.flatMap(() => moves.takeUntilBy(ups));

const length = (p) => Math.sqrt(Math.pow(p[0], 2) + Math.pow(p[1], 2));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const distance = (a, b) => length(sub(a, b));

const empty = (elem) => {
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
};

drags.onValue((mouse) => {
    if (selection !== -1) {
        const dx = mouse[0] - lastMouse[0];
        const dy = mouse[1] - lastMouse[1];
        const part = model.data[selection];

        part.point[0] += dx;
        part.point[1] += dy;

        if (part.control1) {
            part.control1[0] += dx;
            part.control1[1] += dy;
        }
        if (part.control2) {
            part.control2[0] += dx;
            part.control2[1] += dy;
        }

        updatePath(pathElem, model);
        empty(overlayLayer);

        getLines(model).forEach((line) => overlayLayer.appendChild(createLine(line)));
        getPoints(model).forEach((point) => overlayLayer.appendChild(createCircle(point)));
    }
    lastMouse = mouse;
});

let selection = -1;
let lastMouse = null;

downs.onValue((mouse) => {
    // TODO: return an object with the index and the property name of the point
    // being hit by the mouse
    selection = model.data.findIndex((part) => {
        return distance(mouse, part.point) < 10;
    });
    lastMouse = mouse;
});

ups.onValue((mouse) => {
    selection = -1;
    lastMouse = null;
});

document.body.style.background = 'gray';
svg.style.background = 'white';
