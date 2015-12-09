function Binset(data) {
    var self = this;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);
}

function ChordPanel() {
    var self = this;
    self.template = "chord";
    self.firstSelectedBinset = ko.observable();
    self.secondSelectedBinset = ko.observable();

    self.switchSelectedBinsets = function() {
        var tmp = self.firstSelectedBinset();
        self.firstSelectedBinset(self.secondSelectedBinset());
        self.secondSelectedBinset(tmp);
    };
}

function ViewModel() {
    var self = this;
    self.binsets = ko.observableArray([]);

    // Panels
    self.panels = ko.observableArray([new ChordPanel(), new ChordPanel()]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };

    $.getJSON('/binsets', function(data) {
        var binsets = $.map(data, function(binset) { return new Binset(binset) });
        self.binsets(binsets);
        console.log('viewmodel done');
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
