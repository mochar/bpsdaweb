// --- Scatter
var width = 500, height = 500;

function createScatterplot(element) {
    var svg = d3.select(element).append("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g");

    svg.append("g").attr("id", "circle");
    svg.append("g")
        .attr("id", "xAxis")
        .attr("class", "x axis")
        .attr("transform", "translate(0, " + height + ")");
    svg.append("g")
        .attr("id", "yAxis")
        .attr("class", "y axis");
}

function updateScatterplot(element, contigs) {
    var svg = d3.select(element);

    // setup x
    var xValue = function(contig) { return contig.length; };
    var xScale = d3.scale.linear()
        .domain([d3.min(contigs, xValue), d3.max(contigs, xValue)])
        .range([0, width]);
    var xAxis = d3.svg.axis().scale(xScale).orient('bottom');
    var xMap = function(contig) { return xScale(xValue(contig)); };
    svg.select('#xAxis').call(xAxis);

    // setup y
    var yValue = function(contig) { return contig.gc; };
    var yScale = d3.scale.linear()
        .domain([d3.min(contigs, yValue), d3.max(contigs, yValue)])
        .range([height, 0]);
    var yAxis = d3.svg.axis().scale(yScale).orient('left');
    var yMap = function(contig) { return yScale(yValue(contig)); };
    svg.select('#yAxis').call(yAxis);

    var circles = svg.select('#circle').selectAll('circle')
        .data(contigs);

    circles.enter().append('circle')
        .attr('r', 3)
        .attr('cx', xMap)
        .attr('cy', yMap)
        .style('fill', '#ff0000');

    circles.exit().remove();
}
