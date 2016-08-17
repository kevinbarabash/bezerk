const MOVE_TO = Symbol();
const LINE_TO = Symbol();
const QUAD_CURVE_TO = Symbol();
const CUBIC_CURVE_TO = Symbol();

// types of objects:
// - paths
// - groups


const identity = [1, 0, 0, 1, 0, 0];


// order is paint order
const scene = {
    children: [],
    transform: identity,
};

// TODO: make this an object with parts being a prop, etc.
const pathModel = [
    {
        type: MOVE_TO,
        point: [100, 100],
    },
    {
        type: LINE_TO,
        point: [200, 100],
    },
    {
        type: LINE_TO,
        point: [200, 200],
    },
    {
        type: QUAD_CURVE_TO,
        cp: [200, 300],
        point: [300, 300],
    },
    {
        type: CUBIC_CURVE_TO,
        cp1: [400, 300],
        cp2: [300, 400],
        point: [400, 400],
    },
];

// SVG utils

const concat = (array) => array.reduce((result, item) => `${result}${item}`, '');
const flatten = (array) => array.reduce(
    (result, item) => result.concat(Array.isArray(item) ? flatten(item) : item),
    []
);
const sum = (array) => array.reduce((result, item) => result + item, 0);
const average = (array) => sum(array) / array.length;

const partToPoints = {
    [MOVE_TO]: (part) => [part.point],
    [LINE_TO]: (part) => [part.point],
    [QUAD_CURVE_TO]: (part) => [part.cp, part.point],
    [CUBIC_CURVE_TO]: (part) => [part.cp1, part.cp2, part.point],
};

const getPoints = (model) => [].concat(...model.map((part) => partToPoints[part.type](part)));

const getLines = (model) => {
    let lastPoint = null;
    const lines = [];
    for (const part of model) {
        switch (part.type) {
            case MOVE_TO:
                lastPoint = part.point;
                break;
            case LINE_TO:
                lastPoint = part.point;
                break;
            case QUAD_CURVE_TO:
                lines.push([lastPoint, part.cp]);
                lines.push([part.cp, part.point]);
                lastPoint = part.point;
                break;
            case CUBIC_CURVE_TO:
                lines.push([lastPoint, part.cp1]);
                lines.push([part.cp2, part.point]);
                lastPoint = part.point;
                break;
            default:
                throw new Error('unsupported path part');
        }
    }
    return lines;
};

const conversions = {
    [MOVE_TO]: (part) => `M${part.point.join(',')}`,
    [LINE_TO]: (part) => `L${part.point.join(',')}`,
    [QUAD_CURVE_TO]: (part) => `Q${part.cp.join(',')},${part.point.join(',')}`,
    [CUBIC_CURVE_TO]: (part) => `C${part.cp1.join(',')},${part.cp2.join(',')},${part.point.join(',')}`,
};

const setAttributes = (elem, attributes) => {
    for (const [name, value] of Object.entries(attributes)) {
        elem.setAttribute(name, value);
    }
};

const dString = (model) => concat(model.map((part) => conversions[part.type](part)));

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

const pathElem = createPath(pathModel);
drawingLayer.appendChild(pathElem);

getLines(pathModel).forEach((line) => overlayLayer.appendChild(createLine(line)));
getPoints(pathModel).forEach((point) => overlayLayer.appendChild(createCircle(point)));


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

drags.onValue((value) => {
    if (selection !== -1) {
        const part = pathModel[selection];
        part.point = value;
        updatePath(pathElem, pathModel);
        empty(overlayLayer);

        getLines(pathModel).forEach((line) => overlayLayer.appendChild(createLine(line)));
        getPoints(pathModel).forEach((point) => overlayLayer.appendChild(createCircle(point)));
    }
});

let selection = -1;

downs.onValue((mouse) => {
    // TODO: return an object with the index and the property name of the point
    // being hit by the mouse
    selection = pathModel.findIndex((part) => {
        return distance(mouse, part.point) < 5;
    });
});

ups.onValue((mouse) => selection = -1);

document.body.style.background = 'gray';
svg.style.background = 'white';
