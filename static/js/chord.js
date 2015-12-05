// --- Chord
var svg;
//var width = 960, height = 500;
var width = 768, height = 500;
var innerRadius = Math.min(width, height) * .41,
    outerRadius = innerRadius * 1.1;

function createChord() {
    svg = d3.select("#chordPlot").append("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    svg.append("g").attr("id", "group");
    svg.append("g").attr("id", "chord");
}

// Returns an event handler for fading a given chord group.
function fade(opacity) {
    return function(g, i) {
        svg.selectAll("#chord path")
            .filter(function(d) { return d.source.index != i && d.target.index != i; })
            .transition()
            .style("opacity", opacity);
    };
}

function updateChord(matrix) {
    var chord = d3.layout.chord()
        .padding(.05)
        .matrix(matrix);

    var colors = [];
    for (var i = 0; i < matrix.length; i++) {
        colors.push('#FFFFFF')
    };

    var fill = d3.scale.ordinal()
        .domain(d3.range(colors.length))
        .range(colors);

    // Update groups
    var groupPaths = svg.select('#group')
        .selectAll('path')
        .data(chord.groups(), function(d) {
            return d.index;
        });

    groupPaths.enter()
      .append("path")
        .on("mouseover", fade(.1))
        .on("mouseout", fade(1))
        .on("click", function(d) {console.log(d.index); console.log(fill(d.index))} );

    // TODO: handle update better??
    groupPaths.transition()
        .attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius))
        .style("fill", function(d) { return fill(d.index); })
        .style("stroke", function(d) { return '#000000'; });

    groupPaths.exit()
        .transition()
        .remove();

    // Update chords
    var chordPaths = svg.select('#chord')
        .selectAll('path')
        .data(chord.chords(), function(d) {
            if (d.source.index < d.target.index)
                return d.source.index + "-" + d.target.index;
            return d.target.index + "-" + d.source.index;
        });

    chordPaths.enter()
      .append("path")
        .style("opacity", 1);

    // TODO: handle update better??
    chordPaths
        .transition()
        .attr("d", d3.svg.chord().radius(innerRadius))
        .style("fill", function(d) { return fill(d.source.index); });

    chordPaths.exit()
        .transition()
        .remove();
}
