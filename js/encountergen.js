"use strict";

const JSON_URL = "data/encounters.json";

let encounterList;
const renderer = Renderer.get();

function makeContentsBlock (i, loc) {
	let out = "<ul>";
	loc.tables.forEach((t, j) => {
		const tableName = getTableName(loc, t);
		out += `<li class="lst--border"><a id="${i},${j}" href="#${UrlUtil.encodeForHash([loc.name, loc.source, `${t.minlvl}-${t.maxlvl}`])}" title="${tableName}">${tableName}</a></li>`;
	});
	out += "</ul>";
	return out;
}

function getTableName (loc, table) {
	return `${loc.name} Encounters (Levels ${table.minlvl}\u2014${table.maxlvl})`;
}

window.onload = function load () {
	ExcludeUtil.pInitialise(); // don't await, as this is only used for search
	DataUtil.loadJSON(JSON_URL).then(onJsonLoad);
};

window.onhashchange = () => {
	const [link] = Hist.getHashParts();
	const $a = $(`a[href="#${link}"]`);
	if (!$a.length || !link) {
		window.location.hash = $(`.list.encounters`).find("a").attr("href");
		return;
	}
	const id = $a.attr("id");
	document.title = `${$a.attr("title")} - 5etools`;
	loadHash(id);
};

let list;
function onJsonLoad (data) {
	encounterList = data.encounter;

	list = ListUtil.initList({
		listClass: "encounters"
	});
	ListUtil.setOptions({primaryLists: [list]});

	for (let i = 0; i < encounterList.length; i++) {
		const loc = encounterList[i];

		const eleLi = document.createElement("li");

		eleLi.innerHTML = `<span class="name" onclick="showHideList(this)" title="Source: ${Parser.sourceJsonToFull(loc.source)}">${loc.name}</span>${makeContentsBlock(i, loc)}`;

		const listItem = new ListItem(i, eleLi, loc.name);

		list.addItem(listItem);
	}

	list.init();
	RollerUtil.addListRollButton();
	window.onhashchange();
}

function showHideList (ele) {
	const $ele = $(ele);
	$ele.next(`ul`).toggle();
}

function loadHash (id) {
	renderer.setFirstSection(true);

	const [iLoad, jLoad] = id.split(",").map(n => Number(n));
	const location = encounterList[iLoad];
	const table = location.tables[jLoad].table;
	const tableName = getTableName(location, location.tables[jLoad]);

	let htmlText = `
		<tr>
			<td colspan="6">
				<table class="striped-odd">
					<caption>${tableName}</caption>
					<thead>
						<tr>
							<th class="col-2 text-center">
								<span class="roller" onclick="rollAgainstTable('${iLoad}', '${jLoad}')">d100</span>
							</th>
							<th class="col-10">Encounter</th>
						</tr>
					</thead>`;

	for (let i = 0; i < table.length; i++) {
		const range = table[i].min === table[i].max ? pad(table[i].min) : `${pad(table[i].min)}-${pad(table[i].max)}`;
		htmlText += `<tr><td class="text-center p-0">${range}</td><td class="p-0">${getRenderedText(table[i].result)}</td></tr>`;
	}

	htmlText += `
				</table>
			</td>
		</tr>`;
	$("#pagecontent").html(htmlText);

	// update list highlights
	$(".list.names").find(`.list-multi-selected`).removeClass("list-multi-selected");
	$(`a[id="${id}"]`).parent().addClass("list-multi-selected");
}

function pad (number) {
	return String(number).padStart(2, "0");
}

function getRenderedText (rawText) {
	if (rawText.indexOf("{@") !== -1) {
		const stack = [];
		renderer.recursiveRender(rawText, stack);
		return stack.join("");
	} else return rawText;
}

function rollAgainstTable (iLoad, jLoad) {
	iLoad = Number(iLoad);
	jLoad = Number(jLoad);
	const location = encounterList[iLoad];
	const table = location.tables[jLoad];
	const rollTable = table.table;

	const roll = RollerUtil.randomise(99, 0);

	let result;
	for (let i = 0; i < rollTable.length; i++) {
		const row = rollTable[i];
		const trueMin = row.max != null && row.max < row.min ? row.max : row.min;
		const trueMax = row.max != null && row.max > row.min ? row.max : row.min;
		if (roll >= trueMin && roll <= trueMax) {
			result = getRenderedText(row.result);
			break;
		}
	}

	// add dice results
	result = result.replace(RollerUtil.DICE_REGEX, function (match) {
		const r = Renderer.dice.parseRandomise2(match);
		return `<span class="roller" onmousedown="event.preventDefault()" onclick="reroll(this)">${match}</span> (<span class="result">${r}</span>)`
	});

	Renderer.dice.addRoll({name: `${location.name} (${table.minlvl}-${table.maxlvl})`}, `<span><strong>${pad(roll)}</strong> ${result}</span>`);
}

function reroll (ele) {
	const $ele = $(ele);
	const resultRoll = Renderer.dice.parseRandomise2($ele.html());
	const $result = $ele.next(".result");
	const oldText = $result.text().replace(/\(\)/g, "");
	$result.html(resultRoll);
	JqueryUtil.showCopiedEffect($result, oldText, true);
}
