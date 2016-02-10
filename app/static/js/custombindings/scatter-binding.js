ko.bindingHandlers.scatterSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = 550 - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom,
            svg = d3.select(element).append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
               .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // add the tooltip area
        d3.select('body').append("div")
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
        var contigs = bindingContext.$parent.contigs(),
            selectedContigs = bindingContext.$parent.selectedContigs,
            xData = bindingContext.$data.xData(),
            xLogarithmic = bindingContext.$data.xLogarithmic(),
            yData = bindingContext.$data.yData(),
            yLogarithmic = bindingContext.$data.yLogarithmic();

        var margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = 550 - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom,
            svg = d3.select(element).select("g"),
            tooltip = d3.select('body').select('.tooltip');

        // setup x
        var xValue = function(d) { return d[xData];}, // data -> value
            xScale = xLogarithmic ? d3.scale.log().range([0, width]) : // value -> display
                                    d3.scale.linear().range([0, width]),
            xMap = function(d) { return xScale(xValue(d));}, // data -> display
            xAxis = d3.svg.axis().scale(xScale).orient("bottom");

        // setup y
        var yValue = function(d) { return d[yData];},
            yScale = yLogarithmic ? d3.scale.log().range([height, 0]) :
                                    d3.scale.linear().range([height, 0]),
            yMap = function(d) { return yScale(yValue(d));},
            yAxis = d3.svg.axis().scale(yScale).orient("left");

        // don't want dots overlapping axis, so add in buffer to data domain
        xScale.domain([d3.min(contigs, xValue), d3.max(contigs, xValue)]);
        yScale.domain([d3.min(contigs, yValue), d3.max(contigs, yValue)]);

        // axes
        svg.select('.x').transition().duration(500).call(xAxis);
        svg.select('.x').select('.label').text(xData);
        svg.select('.y').transition().duration(500).call(yAxis);
        svg.select('.y').select('.label').text(yData);

        // draw dots
        var dots = svg.selectAll(".dot").data(contigs, function(d) { return d.id; });

        dots.exit()
            .transition()
            .attr('r', 0)
            .remove();

        dots.enter().append("circle")
            .attr("class", "dot")
            .attr("r", 0)
            .style('opacity', 0.5)
            .style("fill", function(d) { return d.color; })
            .on("mouseover", function(d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
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
                var isSelected = selectedContigs.indexOf(d) > -1;
                d3.select(this).style("opacity", isSelected ? 0.5 : 1);
                isSelected ? selectedContigs.remove(d) : selectedContigs.push(d);
            });

        dots.transition()
            .style("fill", function(d) { return d.color; })
            .attr("r", 4)
            .attr("cx", xMap)
            .attr("cy", yMap);
    }
};
