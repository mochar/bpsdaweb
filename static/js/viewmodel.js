ko.bindingHandlers.chordSvg = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        createChord(element);
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log("Update chord panel");
        var matrix = bindingContext.$data.matrix();
        var unifiedColor = bindingContext.$data.unifiedColor();
        var bins = bindingContext.$data.bins;

        updateChord(element, matrix, bins, unifiedColor);
        d3.select(element).selectAll('#group path')
            .on('click', function(d) {
                bindingContext.$data.selectedBin(bins[d.index]);
            });
    }
};

ko.bindingHandlers.slideVisible = {
    init: function(element, valueAccessor) {
        var visible = ko.unwrap(valueAccessor());
        $(element).toggle(visible);
    },
    update: function(element, valueAccessor) {
        var visible = ko.unwrap(valueAccessor());
        if (visible) {
            $(element).hide().slideDown();
        } else {
            $(element).slideUp();
        }
    }
};

ko.bindingHandlers.tooltip = {
    init: function(element, valueAccessor) {
        var local = ko.utils.unwrapObservable(valueAccessor());
        var options = {placement: 'right'};
        ko.utils.extend(options, local);
        $(element).tooltip(options);
    }
};

ko.extenders.trackChange = function(target, track) {
    if (track) {
        target.isDirty = ko.observable(false);
        target.originalValue = target();
        target.subscribe(function(newValue) {
            target.isDirty(newValue != target.originalValue);
        })
    }
    return target;
};

function BinsetPanel(binset) {
    var self = this;
    self.template = "binsetPanel";
    self.binset = ko.observable(binset);
}

function ContigsPanel() {
    var self = this;
    self.template = "contigsPanel";
    self.selectedContigsets = ko.observableArray([]);
}

function ChordPanel() {
    var self = this;
    self.template = "chordPanel";
    self.selectedBinset1 = ko.observable(null).extend({trackChange: true});
    self.selectedBinset2 = ko.observable(null).extend({trackChange: true});
    self.selectedBin = ko.observable('test');
    self.showSettings = ko.observable(false);

    self.unifiedColor = ko.observable(false);
    self.matrix = ko.observable([]);
    self.bins = [];

    self.switchSelectedBinsets = function() {
        var tmp = self.selectedBinset1();
        self.selectedBinset1(self.selectedBinset2());
        self.selectedBinset2(tmp);
    };

    self.toggleSettings = function() {
        self.showSettings(!self.showSettings());
    };

    self.updateChordPanel = function() {
        if (self.selectedBinset1.isDirty() || self.selectedBinset2.isDirty()) {
            console.log('Dirty');
            var binsets = [self.selectedBinset1(), self.selectedBinset2()];
            var binIds = binsets[0].bins().concat(binsets[1].bins());
            var data = {bins: binIds.join(',')};
            var url = '/contigsets/' + binsets[0].contigset + '/binsets/';
            $.when(
                $.getJSON('/to_matrix', data),
                $.getJSON(url + binsets[0].id + '/bins'),
                $.getJSON(url + binsets[1].id + '/bins')
            ).done(function(matrix, bins1, bins2) {
                bins1[0].bins.forEach(function(b) {
                    $.extend(b, {binsetColor: binsets[0].color()});
                });
                bins2[0].bins.forEach(function(b) {
                    $.extend(b, {binsetColor: binsets[1].color()});
                });
                self.bins = bins1[0].bins.concat(bins2[0].bins);
                self.matrix(matrix[0]);
            });
        }
    };
}

function Binset(data) {
    var self = this;
    self.id = data.id;
    self.contigset = data.contigset;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);

    self.editingName = ko.observable(false);
    self.editName = function() { self.editingName(true); }
}

function Contigset(data) {
    var self = this;
    self.id = data.id;
    self.name = ko.observable(data.name);
    self.contigs = ko.observableArray(data.contigs);
    self.binsets = ko.observableArray([]);

    $.getJSON('/contigsets/' + self.id + '/binsets', function(data) {
        self.binsets(data.binsets.map(function(bs) { return new Binset(bs); }));
    });

    self.showDelete = ko.observable(false);
    self.toggleDelete = function() { self.showDelete(!self.showDelete()); };
}

function ViewModel() {
    var self = this;
    self.contigsets = ko.observableArray([]);
    self.selectedContigset = ko.observable(null);
    self.contigs = ko.observableArray([]);

    self.binsets = ko.pureComputed(function() {
        var contigsets = self.contigsets();
        var binsets = [];
        ko.utils.arrayForEach(contigsets, function(contigset) {
            binsets = binsets.concat(contigset.binsets());
        });
        return binsets;
    });

    self.contigsetsToShow = ko.pureComputed(function() {
        var selectedContigset = self.selectedContigset();
        return selectedContigset ? [selectedContigset] : self.contigsets();
    });

    self.binsetsToShow = ko.pureComputed(function() {
        var contigset = self.selectedContigset();
        return contigset ? contigset.binsets() : self.binsets();
    });

    ko.computed(function() {
        var contigset = self.selectedContigset();
        if (!contigset) return;
        var data = {items: 50};
        $.getJSON('/contigsets/' + contigset.id + '/contigs', data, function(data) {
            self.contigs(data.contigs);
        });
    });

    self.showFilters = ko.observable(false);
    self.toggleFilters = function() { self.showFilters(!self.showFilters()); };

    self.showElement = function(elem) { if (elem.nodeType === 1) $(elem).hide().slideDown() };
    self.hideElement = function(elem) { if (elem.nodeType === 1) $(elem).slideUp(function() { $(elem).remove(); }) };

    // Panels
    self.panels = ko.observableArray([new ChordPanel(), //new BinsetPanel("kek"),
        new ContigsPanel()]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };
    self.removePanel = function(panel) {
        self.panels.remove(panel);
    };
    self.newChordPanel = function() {
        self.panels.unshift(new ChordPanel());
    };


    self.removeBinset = function(binset) {
        self.binsets.remove(binset);
    };

    self.deleteContigset = function(contigset) {
        $.ajax({
            url: '/contigsets/' + contigset.id,
            type: 'DELETE',
            success: function(response) {
            }
        });
        self.contigsets.remove(contigset);
    };

    // Data upload
    self.uploadContigset = function(formElement) {
        var formData = new FormData(formElement);
        formElement.reset();
        $.ajax({
            url: '/contigsets',
            type: 'POST',
            data: formData,
            async: false,
            success: function (data) {
                self.contigsets.push(new Contigset(data));
            },
            cache: false,
            contentType: false,
            processData: false
        });
    };

    self.uploadBinset = function(formElement) {
        var formData = new FormData(formElement);
        var contigsetId = $('#binsetContigset').val();
        $('#binTable > tbody > tr').remove();
        formElement.reset();

        $.ajax({
            url: '/contigsets/' + contigsetId + '/binsets',
            type: 'POST',
            data: formData,
            async: false,
            success: function (data) {
                var contigsets = self.contigsets();
                for(var i = 0; i < contigsets.length; i++) {
                    if (contigsets[i].id == contigsetId) {
                        contigsets[i].binsets.push(new Binset(data));
                        break;
                    }
                }
            },
            cache: false,
            contentType: false,
            processData: false
        });
    };

    // Data
    $.getJSON('/contigsets', function(data) {
        self.contigsets($.map(data.contigsets, function(cs) { return new Contigset(cs); }));
        console.log('viewmodel: got contigsets');
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
