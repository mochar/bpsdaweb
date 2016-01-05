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

ko.bindingHandlers.scatterSvg = {
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        createScatterplot(element);
    },
    update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log("Update scatterplot panel");
        var contigs = bindingContext.$data.contigs();

        updateScatterplot(element, contigs, bindingContext.$data.selectedContigs);
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
    self.xAxis = ko.observable();
    self.yAxis = ko.observable();
    self.selectedContigsets = ko.observableArray([]);
    self.contigs = ko.observableArray([]);
    self.selectedContigs = ko.observableArray([]);

    ko.computed(function() {
        var contigsets = self.selectedContigsets();
        for(var i = 0; i < contigsets.length; i++) {
            var data = {items: contigsets[i].length};
            data = {};
            var url = '/contigsets/' + contigsets[i].id + '/contigs';
            $.getJSON(url, data, function(data) {
                self.contigs(data.contigs);
            });
        }
    });
}

function ChordPanel() {
    var self = this;
    self.template = "chordPanel";
    self.selectedBinset1 = ko.observable(null).extend({trackChange: true});
    self.selectedBinset2 = ko.observable(null).extend({trackChange: true});
    self.selectedBin = ko.observable();
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

function ContigSection() {
    var self = this;
    self.contigs = ko.observableArray([]);
    self.contigsetId = ko.observable();
    self.showFilters = ko.observable(false);
    self.toggleFilters = function() { self.showFilters(!self.showFilters()); };
    self.view = ko.observable('table'); // Either table or plot
    self.queryOptions = ko.observable({items: 7, index: 1, sort: 'name'});

    self.sort = function(by) {
        var queryOptions = self.queryOptions();
        queryOptions.sort = by;
        self.queryOptions(queryOptions);
    };

    ko.computed(function() {
        var contigsetId = self.contigsetId();
        var queryOptions = self.queryOptions();
        if (!contigsetId) return;
        $.getJSON('/contigsets/' + contigsetId + '/contigs', queryOptions, function(data) {
            self.contigs(data.contigs);
        });
    });
}

function Binset(data) {
    var self = this;
    self.id = data.id;
    self.contigset = data.contigset;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);

    self.showDelete = ko.observable(false);
    self.toggleDelete = function() { self.showDelete(!self.showDelete()); };

    // Renaming
    self.renaming = ko.observable(false);
    self.rename = function() { self.renaming(true); };
    ko.computed(function() {
        var name = self.name();
        $.ajax({
            url: '/contigsets/' + self.contigset + '/binsets/' + self.id,
            type: 'PUT',
            data: {'name': name}
        });
    });
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

    // Renaming
    self.renaming = ko.observable(false);
    self.rename = function() { self.renaming(true); };
    ko.computed(function() {
        var name = self.name();
        $.ajax({
            url: '/contigsets/' + self.id,
            type: 'PUT',
            data: {'name': name}
        });
    });
}

function ViewModel() {
    var self = this;
    self.contigsets = ko.observableArray([]);
    self.selectedContigset = ko.observable(null);
    self.selectedBinset = ko.observable(null);
    self.contigSection = new ContigSection();

    self.binsets = ko.pureComputed(function() {
        var contigsets = self.contigsets();
        var binsets = [];
        ko.utils.arrayForEach(contigsets, function(contigset) {
            binsets = binsets.concat(contigset.binsets());
        });
        return binsets;
    });

    self.contigsetsToShow = ko.pureComputed(function() {
        var contigset = self.selectedContigset();
        return contigset ? [contigset] : self.contigsets();
    });

    self.binsetsToShow = ko.pureComputed(function() {
        var contigset = self.selectedContigset();
        var binset = self.selectedBinset();
        if (binset) return binset;
        return contigset ? contigset.binsets() : self.binsets();
    });

    ko.computed(function() {
        var contigset = self.selectedContigset();
        if (!contigset) return;
        self.contigSection.contigsetId(contigset.id);
    });

    self.showElement = function(elem) { if (elem.nodeType === 1) $(elem).hide().slideDown() };
    self.hideElement = function(elem) { if (elem.nodeType === 1) $(elem).slideUp(function() { $(elem).remove(); }) };

    // Panels
    self.panels = ko.observableArray([new ContigsPanel(), new ChordPanel()]);
    self.getPanelTemplate = function(panel) {
        return panel.template;
    };
    self.removePanel = function(panel) {
        self.panels.remove(panel);
    };
    self.newChordPanel = function() {
        self.panels.unshift(new ChordPanel());
    };


    self.contigsetFromId = function(id) {
        for(var i = 0; i < self.contigsets().length; i++) {
            if (self.contigsets()[i].id == id) return self.contigsets()[i];
        }
    };


    self.deleteBinset = function(binset) {
        $.ajax({
            url: '/contigsets/' + binset.contigset + '/binsets/' + binset.id,
            type: 'DELETE',
            success: function(response) {
            }
        });
        var contigset = self.contigsets().filter(function(cs) {
            return cs.id === binset.contigset;
        })[0];
        contigset.binsets.remove(binset);
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
