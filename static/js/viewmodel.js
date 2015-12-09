function Binset(data) {
    var self = this;
    self.name = ko.observable(data.name);
    self.bins = ko.observableArray(data.bins);
}

function ViewModel() {
    var self = this;
    self.binsets = ko.observableArray();

    $.getJSON('/binsets', function(data) {
        var binsets = $.map(data, function(binset) { return new Binset(binset) });
        self.binsets(binsets);
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
