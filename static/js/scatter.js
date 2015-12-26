function createScatterplot(element) {
    var margin = {top: 20, right: 20, bottom: 30, left: 50},
        width = 500 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    var svg = d3.select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // add the tooltip area
    var tooltip = d3.select(element).append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // axes
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")");

    svg.append("g")
        .attr("class", "y axis");
}

function updateScatterplot(element, contigs) {
    var contigs_remove = [];

    var x_data = "gc",
        y_data = "length",
        colour = "#58ACFA";

    var margin = {top: 20, right: 20, bottom: 30, left: 50},
        width = 500 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    // setup x
    var xValue = function(d) { return d[x_data];}, // data -> value
        xScale = d3.scale.linear().range([0, width]), // value -> display
        xMap = function(d) { return xScale(xValue(d));}, // data -> display
        xAxis = d3.svg.axis().scale(xScale).orient("bottom");

    // setup y
    var yValue = function(d) { return d[y_data];}, // data -> value
        yScale = d3.scale.linear().range([height, 0]), // value -> display
        yMap = function(d) { return yScale(yValue(d));}, // data -> display
        yAxis = d3.svg.axis().scale(yScale).orient("left");

    var svg = d3.select(element).select('svg');

    // don't want dots overlapping axis, so add in buffer to data domain
    xScale.domain([d3.min(contigs, xValue)-1, d3.max(contigs, xValue)+1]);
    yScale.domain([d3.min(contigs, yValue)-1, d3.max(contigs, yValue)+1]);

    // x-axis
    svg.select('g.x')
        .call(xAxis)
      .append("text")
        .attr("class", "label")
        .attr("x", width)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text(x_data);

    // y-axis
    svg.select('g.y')
        .call(yAxis)
      .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(y_data);

    // draw dots
    var dots = svg.selectAll(".dot").data(contigs);

    dots.exit().remove();

    dots.enter().append("circle")
        .attr("class", "dot")
        .attr("r", 4)
        .attr("cx", xMap)
        .attr("cy", yMap)
        .style("fill", colour)
        .style("opacity", .5)
        .on("mouseover", function(d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(d.contig + "<br/> (" + xValue(d)
                    + ", " + yValue(d) + ")")
                .style("left", (d3.event.pageX + 5) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", function(d) {
            var active = this.active ? false : true,
                newOpacity = active ? 1 : 0.5;
            d3.select(this)
                .style("opacity", newOpacity);

            this.active = active;

            if (this.active) {
                contigs_remove.push(d.contig);
            } else {
                var contig_index = contigs_remove.indexOf(d.contig);
                if (contig_index > -1 ) {
                    contigs_remove.splice(contig_index, 1);
                }
            }
        });
}
