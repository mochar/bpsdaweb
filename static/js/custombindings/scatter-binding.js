ko.bindingHandlers.scatterSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 10, right: 0, bottom: 10, left: 10},
            width = 500 - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom,
            svg = d3.select(element).append("svg")
                .attr("width", width)
                .attr("height", height)
                .append("g");

        // add the tooltip area
        d3.select(element).append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // axes
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
          .append("text")
            .attr("class", "label")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end");

        svg.append("g")
            .attr("class", "y axis")
          .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end");
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log('update scatter plot');
        var contigs = bindingContext.$data.contigs(),
            selectedContigs = bindingContext.$data.selectedContigs,
            xData = bindingContext.$data.xData(),
            yData = bindingContext.$data.yData(),
            colour = "#58ACFA";

        var margin = {top: 10, right: 0, bottom: 10, left: 10},
            width = 500 - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom,
            svg = d3.select(element).select("g"),
            tooltip = d3.select(element).select('.tooltip');


        // setup x
        var xValue = function(d) { return d[xData];}, // data -> value
            xScale = d3.scale.linear().range([0, width]), // value -> display
            xMap = function(d) { return xScale(xValue(d));}, // data -> display
            xAxis = d3.svg.axis().scale(xScale).orient("bottom");

        // setup y
        var yValue = function(d) { return d[yData];}, // data -> value
            yScale = d3.scale.linear().range([height, 0]), // value -> display
            yMap = function(d) { return yScale(yValue(d));}, // data -> display
            yAxis = d3.svg.axis().scale(yScale).orient("left");

        // don't want dots overlapping axis, so add in buffer to data domain
        xScale.domain([d3.min(contigs, xValue) - 1, d3.max(contigs, xValue) + 1]);
        yScale.domain([d3.min(contigs, yValue) - 1, d3.max(contigs, yValue) + 1]);

        // axes
        svg.select('g.x').call(xAxis).select('.label').text(xData);
        svg.select('g.y').call(yAxis).select(".label").text(yData);

        // draw dots
        var dots = svg.selectAll(".dot").data(contigs, function(d) { return d.id; });

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
                tooltip.html(d.name)
                    .style("left", (d3.event.pageX + 5) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function(d) {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("click", function(d) {
                var selected = selectedContigs().indexOf(d) === -1,
                    newOpacity = selected ? 1 : 0.5;
                d3.select(this).style("opacity", newOpacity);
                selected ? selectedContigs.push(d) : selectedContigs.remove(d);
            });
    }
};
