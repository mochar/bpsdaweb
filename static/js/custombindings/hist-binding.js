ko.bindingHandlers.histSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var margin = {top: 1, right: 1, bottom: 2, left: 1},
            width = 100 - margin.left - margin.right,
            height = 100 - margin.top - margin.bottom,
            svg = d3.select(element).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," +
                margin.top + ")");

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");

        svg.append("text")
            .attr("class", "xlabel")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 10);
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var contigs = bindingContext.$data.contigs();

        var margin = {top: 1, right: 1, bottom: 2, left: 1},
            width = 100 - margin.left - margin.right,
            height = 100 - margin.top - margin.bottom,
            svg = d3.select(element).select("g");
    }
};
