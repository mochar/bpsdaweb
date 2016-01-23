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

ko.bindingHandlers.colorpicker = {
    init: function(element, valueAccessor) {
        var color = valueAccessor();
        $(element).colpick({
            onSubmit: function(hsb, hex) {
                color('#' + hex);
            }
        });
    }
};

ko.bindingHandlers.borderColor = {
    update: function(element, valueAccessor) {
        var color = ko.unwrap(valueAccessor());
        $(element).css('border-left-color', color);
        $(element).css('border-left-width', '4px');
    }
};

function ContigsetPage(contigset) {
    var self = this;
    self.contigset = contigset;

    self.plotContigsDirty = ko.observable(false);
    self.plotContigs = [];

    ko.computed(function() {
        var contigset = self.contigset();
        if (!contigset) return;
        console.log("ContigsetPage contigset update");

        // reset
        self.plotContigs = [];
        self.plotContigsDirty(true);

        //var queryOptions = {items: contigset.size(), fields: 'gc,length'};
        var queryOptions = {items: 3500, fields: 'gc,length'};
        $.getJSON('/contigsets/' + contigset.id + '/contigs', queryOptions, function(data) {
            self.plotContigs = data.contigs;
            self.plotContigsDirty(true);
        });
    });
}

function ScatterplotPanel() {
    var self = this;
    self.contigset = ko.observable(null);
    self.binIds = ko.observableArray([]);

    self.xData = ko.observable('gc');
    self.xLogarithmic = ko.observable(false);

    self.yData = ko.observable('length');
    self.yLogarithmic = ko.observable(false);

    self.selectedContigs = ko.observableArray([]);
    self.contigs = ko.observableArray([]);

    self.color = ko.observable('#58ACFA');
    self.colorMethod = ko.observable('uniform'); // uniform || binset
    self.colorBinset = ko.observable();

    ko.computed(function() {
        var binIds = self.binIds();
        var contigset = self.contigset();
        if (binIds.length == 0 || !contigset) {
            self.contigs([]);
            return;
        }

        var fields = 'id,' + self.xData() + "," + self.yData();
        var payload = {fields: fields, bins: binIds.join(','),
            items: contigset.size()};
        var url = '/contigsets/' + contigset.id + '/contigs';
        $.getJSON(url, payload, function(data) {
            self.contigs(data.contigs);
        });
    });

    ko.computed(function() {
        var binset = self.colorBinset();
        if (!binset) return;
        self.colorMethod('binset');
    });

    ko.computed(function() {
        var colorMethod = self.colorMethod();
        if (colorMethod === 'uniform') return;
        var binset = self.colorBinset();

        var url = '/contigsets/' + binset.contigset + '/binsets/' + binset.id + '/bins';
        var payload = {fields: 'color', contigs: true};
        $.getJSON(url, payload, function(data) {
            var contigColors = {};
            data.bins.forEach(function(bin) {
                bin.contigs.forEach(function(contig) {
                    contigColors[contig] = bin.color;
                });
            });
            self.contigs(self.contigs().map(function(contig) {
                contig.color = contigColors[contig.id];
                return contig;
            }));
        });
    });

    self.updatePlot = function() {
        var contigset = self.contigset();
        if (!contigset) {
            self.contigs([]);
            self.colorMethod('uniform');
            return;
        }
        var fields = self.xData() + "," + self.yData();
        //var data = {fields: fields};
        var data = {items: 100, length: "5000+"};
        var url = '/contigsets/' + contigset.id + '/contigs';
        $.getJSON(url, data, function(data) {
            self.contigs(data.contigs.map(function(contig) {
                $.extend(contig, contig.coverages);
                delete contig.coverages;
                return contig;
            }));
        });
    };
}

function ChordPanel() {
    var self = this;
    self.selectedBinset1 = ko.observable(null);
    self.selectedBinset2 = ko.observable(null);
    self.selectedBin = ko.observable();
    self.selectedBins = ko.observableArray([]);
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
    };
}

function ContigSection() {
    var self = this;
    self.contigs = ko.observableArray([]);
    self.contigsetId = ko.observable();
    self.showFilters = ko.observable(false);
    self.toggleFilters = function() { self.showFilters(!self.showFilters()); };

    // contig selection
    self.allContigsSelected = ko.observable(false);
    self.selectedContigIds = ko.observableArray([]);
    self.selectedAmount = ko.pureComputed(function() {
        if (self.allContigsSelected()) return self.count();
        return self.selectedContigIds().length;
    });
    ko.computed(function() {
        var contigsetId = self.contigsetId();

        // Unselect all contigs
        self.selectedContigIds([]);
        self.allContigsSelected(false);
    });

    // table
    self.sortBy = ko.observable('name');
    self.sort = function(field) {
        var sortBy = self.sortBy();
        field === sortBy ? self.sortBy('-' + field) : self.sortBy(field);
    };

    // pagination
    self.index = ko.observable(1);
    self.count = ko.observable(null);
    self.indices = ko.observable(null);

    // New contigset selected
    ko.computed(function() {
        var contigsetId = self.contigsetId();
        if (!contigsetId) return;

        // reset
        self.contigs([]);
        self.count(null);
        self.indices(null);

        // Get new contig data
        var index = self.index(),
            sort = self.sortBy(),
            queryOptions = {index: index, sort: sort, items: 7,
                fields: 'id,name,gc,length'};
        $.getJSON('/contigsets/' + contigsetId + '/contigs', queryOptions, function(data) {
            self.contigs(data.contigs);
            self.count(data.count);
            self.indices(data.indices);
        });
    });
}


function BinSection() {
    var self = this;
    self.binset = ko.observable(null);
    self.bins = ko.observableArray([]);
    self.selectedBinIds = ko.observableArray([]);

    self.sort = function(by) {
        if (!$.isNumeric(self.bins()[0][by])) return self.bins.sort();
        return self.bins.sort(function(left, right) {
            if (left[by] == right[by]) return 0;
            return left[by] < right[by] ? -1 : 1;
        });
    };

    self.deleteBins = function() {
        var binset = self.binset();
        if (!binset) return;
        var ids = self.selectedBinIds();
        console.log(binset.contigset);
        $.ajax({
            url: '/contigsets/' + binset.contigset + '/binsets/' + binset.id + '/bins',
            type: 'DELETE',
            data: {ids: ids.join(",")}
        });
        self.selectedBinIds([]);
        self.bins.remove(function(bin) { return ids.indexOf(bin.id) > -1; });
    };

    ko.computed(function() {
        var binset = self.binset();
        if (!binset) {
            self.bins([]);
            self.selectedBinIds([]);
            return;
        }
        var url = '/contigsets/' + binset.contigset + '/binsets/' + binset.id + '/bins';
        var queryOptions = {items: 5};
        $.getJSON(url, queryOptions, function(data) {
            self.bins(data.bins.map(function(bin) { return new Bin(bin); }));
        });
    });
}


function Bin(data) {
    var self = this;
    self.id = data.id;
    self.name = data.name;
    self.binset = data.binset;
    self.color = ko.observable(data.color);
    self.size = data.size;
    self.gc = data.gc;
    self.n50 = data.N50;
}


function Binset(data) {
    var self = this;
    self.id = data.id;
    self.contigset = data.contigset;
    self.name = ko.observable(data.name);
    self.color = ko.observable(data.color);
    self.bins = ko.observableArray(data.bins);

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
    self.samples = data.samples;
    self.name = ko.observable(data.name);
    self.size = ko.observable(data.size); // amount of contigs

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
    self.binsets = ko.observableArray([]);
    self.selectedContigset = ko.observable(null);
    self.selectedBinset = ko.observable(null);
    self.contigSection = new ContigSection();
    self.binSection = new BinSection();
    self.contigsetPage = new ContigsetPage(self.selectedContigset);

    self.scatterplotPanel = new ScatterplotPanel();
    self.chordPanel = new ChordPanel();

    // On which breadcrumb (nav bar on the top right) we are.
    self.CrumbEnum = {
        CONTIGSETS: 1,
        CONTIGSET: 2,
        BINSETS: 3,
        BINSET: 4
    };
    self.crumb = ko.observable(self.CrumbEnum.CONTIGSETS);

    // On contigset change
    ko.computed(function() {
        var contigset = self.selectedContigset();
        if (contigset) { // A contigset has been selected
            self.crumb(self.CrumbEnum.CONTIGSET);
            self.scatterplotPanel.contigset = self.selectedContigset;
            self.contigSection.contigsetId(contigset.id); // Update contig table

            $.getJSON('/contigsets/' + contigset.id + '/binsets', function(data) {
                self.binsets(data.binsets.map(function(bs) { return new Binset(bs); }));
            });
        } else {
            self.crumb(self.CrumbEnum.CONTIGSETS);
            self.binsets([]);
        }
    });

    // On binset change
    ko.computed(function() {
        var binset = self.selectedBinset();
        self.binSection.binset(binset);
        if (binset) {
            self.crumb(self.CrumbEnum.BINSET);
        }
    });

    // On crumb change
    ko.computed(function() {
        var crumb = self.crumb();
        switch (crumb) {
            case self.CrumbEnum.CONTIGSETS:
                //self.selectedBinset(null);
                //self.selectedContigset(null);
                break;
            case self.CrumbEnum.CONTIGSET:
                self.selectedBinset(null);
                break;
            case self.CrumbEnum.BINSETS:
                self.selectedBinset(null);
                break;
            case self.CrumbEnum.BINSET:
        }
    });

    self.showElement = function(elem) { if (elem.nodeType === 1) $(elem).hide().slideDown() };
    self.hideElement = function(elem) { if (elem.nodeType === 1) $(elem).slideUp(function() { $(elem).remove(); }) };
    
    // Data deletion
    self.deleteBinset = function() {
        var binset = self.selectedBinset();
        $.ajax({
            url: '/contigsets/' + binset.contigset + '/binsets/' + binset.id,
            type: 'DELETE',
            success: function(response) {
            }
        });
        self.binsets.remove(binset);
        self.selectedBinset(null);
        self.crumb(self.CrumbEnum.BINSETS);
    };

    self.deleteContigset = function() {
        var contigset = self.selectedContigset();
        $.ajax({
            url: '/contigsets/' + contigset.id,
            type: 'DELETE',
            success: function(response) {
            }
        });
        self.contigsets.remove(contigset);
        self.selectedContigset(null);
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
        formElement.reset();

        $.ajax({
            url: '/contigsets/' + self.selectedContigset().id + '/binsets',
            type: 'POST',
            data: formData,
            async: false,
            success: function (data) {
                self.binsets.push(new Binset(data));
            },
            cache: false,
            contentType: false,
            processData: false
        });
    };

    // Data
    $.getJSON('/contigsets', function(data) {
        self.contigsets($.map(data.contigsets, function(cs) { return new Contigset(cs); }));
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
