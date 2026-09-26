// Replace the entire old script with this file; do not append it.
const MENTORING_TOKEN = PropertiesService.getScriptProperties().getProperty("MENTORING_SHEETS_TOKEN") || "";
const MENTORING_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty("MENTORING_SPREADSHEET_ID") || "";
const TABS = Object.freeze({
  mentors: "Mentors",
  boys: "Boys",
  programs: "Programs",
  attendance: "Attendance",
  invitations: "Invitations",
  programTypes: "ProgramTypes",
  access: "Access",
  content: "Website Content",
  settings: "Website Settings",
  calendar: "Calendar",
});

// Cache only within one execution, never across users or requests.
let requestSpreadsheet;
let requestTables = {};
function doPost(event) {
  requestSpreadsheet = null;
  requestTables = {};
  let lock;
  try {
    let body = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    if (!safeEqual_(String(body.token || ""), MENTORING_TOKEN)) throw new Error("Unauthorized request.");
    let action = String(body.action || "");
    let access;
    if (action === "check_access") {
      access = checkAccess_(body.email);
      if (!access.allowed) return output_(access);
      if (!body.operation) {
        if (body.includeState === true) access.state = state_();
        return output_(access);
      }
      const email = text_(body.email).toLowerCase();
      body = Object.assign({}, body.operation, { updatedBy: email });
      action = String(body.action || "");
      if (action === "update_website_content" && access.role !== "admin") throw new Error("Only an Admin can update website wording.");
    }
    if (action === "get_state") return output_(state_());

    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error("Another save is in progress. Try again shortly.");
    switch (action) {
      case "add_boy": addBoy_(body); break;
      case "update_boy": updateBoy_(body); break;
      case "delete_boy": deleteBoy_(body); break;
      case "add_program": addProgram_(body); break;
      case "update_program": updateProgram_(body); break;
      case "delete_program": deleteProgram_(body); break;
      case "set_attendance": setAttendance_(body); break;
      case "delete_attendance": deleteAttendance_(body); break;
      case "set_invitation": setInvitation_(body); break;
      case "delete_invitation": deleteInvitation_(body); break;
      case "update_website_content": updateWebsiteContent_(body); break;
      default: throw new Error("Unsupported action.");
    }
    SpreadsheetApp.flush();
    // Re-read after writes, including duplicate-row cleanup and recalculation.
    requestTables = {};
    const state = state_();
    if (access) { access.state = state; return output_(access); }
    return output_(state);
  } catch (error) {
    return output_({ ok: false, error: error && error.message ? error.message : "The Sheet request failed." });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function state_() {
  const mentors = rows_(TABS.mentors).map(function (row, index) {
    const tones = ["saffron", "green", "blue", "plum", "gold"];
    return { id: text_(row["Mentor ID"]), name: text_(row["Mentor Name"]), initials: initials_(row["Mentor Name"]), tone: tones[index % tones.length] };
  }).filter(function (row) { return row.id && row.name; });

  const programTypes = rows_(TABS.programTypes).map(function (row) {
    return { id: text_(row["Program Type ID"]), name: text_(row["Program Name"]) };
  }).filter(function (row) { return row.id && row.name; });
  const typeNames = indexBy_(programTypes, "id", "name");

  const boys = rows_(TABS.boys).map(function (row) {
    return {
      id: text_(row["Boy ID"]), name: text_(row.Name), contact: text_(row.Contact),
      college: text_(row.College), hostel: text_(row["Hostel Name"]), floor: text_(row.Floor), branch: text_(row.Branch),
      section: text_(row.Section), status: allowed_(row.Status, ["Active", "Passive", "Dropped"], "Active"),
      mentorId: text_(row["Mentor ID"]), comment: text_(row.Comment), createdAt: isoTimestamp_(row["Added On"]),
      createdBy: text_(row["Added By"]),
    };
  }).filter(function (row) { return row.id && row.name; });

  const programs = rows_(TABS.programs).map(function (row) {
    const typeId = text_(row["Program Type ID"]);
    const name = text_(row["Program Name"]);
    return {
      id: text_(row["Program ID"]), name: name || typeNames[typeId] || "Program", programTypeId: typeId,
      programType: typeNames[typeId] || name || "Program", date: isoDate_(row.Date), venue: text_(row.Venue),
      speaker: text_(row.Speaker), createdAt: "",
    };
  }).filter(function (row) { return row.id; });

  const attendance = rows_(TABS.attendance).map(function (row) {
    return {
      id: text_(row["Attendance ID"]), programId: text_(row["Program ID"]), mentorId: text_(row["Mentor ID"]),
      boyId: text_(row["Boy ID"]), status: allowed_(row.Status, ["Present", "Absent", "Late"], "Absent"),
      reason: text_(row.Reason), updatedAt: isoTimestamp_(row["Updated On"]), updatedBy: text_(row["Updated By"]),
    };
  }).filter(function (row) { return row.id && row.programId && row.boyId; });

  const invitations = rows_(TABS.invitations).map(function (row) {
    return {
      id: text_(row["Invitation ID"]), programId: text_(row["Program ID"]), mentorId: text_(row["Mentor ID"]),
      boyId: text_(row["Boy ID"]), response: text_(row.Response), updatedAt: isoTimestamp_(row["Updated On"]),
      updatedBy: text_(row["Updated By"]),
    };
  }).filter(function (row) { return row.id && row.programId && row.boyId; });

  const calendarEvents = rows_(TABS.calendar).map(function (row) {
    return {
      id: text_(row["Event ID"]), title: text_(row["Event / Activity"]), startDate: isoDate_(row["Start Date"]),
      endDate: isoDate_(row["End Date"]), type: text_(row.Type), availability: text_(row.Availability),
      semester: text_(row.Semester), scope: text_(row["Institution / Scope"]), note: text_(row["Planning Note"]),
      source: text_(row.Source),
    };
  }).filter(function (row) { return row.id && row.startDate; });

  return {
    ok: true, backendVersion: "header-mapping-v1", capabilities: ["boy-floor-v1"], mentors: mentors, programTypes: programTypes, boys: boys, programs: programs,
    attendance: attendance, invitations: invitations, calendarEvents: calendarEvents,
    websiteContent: keyValues_(TABS.content, "Key", "Value"),
    websiteSettings: keyValues_(TABS.settings, "Setting ID", "Value"),
    refreshedAt: new Date().toISOString(),
  };
}

function checkAccess_(email) {
  const normalized = text_(email).toLowerCase();
  const row = rows_(TABS.access).find(function (item) { return text_(item.Email).toLowerCase() === normalized; });
  const active = row && text_(row.Active).toLowerCase() === "yes";
  return { ok: true, backendVersion: "header-mapping-v1", capabilities: ["boy-floor-v1"], allowed: !!active, name: active ? text_(row.Name) : "", role: active && text_(row.Role).toLowerCase() === "admin" ? "admin" : "mentor" };
}

function addBoy_(body) {
  const mentorId = required_(body.mentorId, "Mentor");
  findObject_(TABS.mentors, "Mentor ID", mentorId);
  appendObject_(TABS.boys, {"Boy ID": id_(), "Name": required_(body.name,"Boy name"),
    "Contact": clean_(body.contact,24), "Branch": clean_(body.branch,100), "Section": clean_(body.section,100),
    "College": clean_(body.college,150), "Hostel Name": clean_(body.hostel,150), "Floor": floorField_(body),
    "Status": allowed_(body.status,["Active","Passive","Dropped"],"Active"), "Mentor ID": mentorId,
    "Comment": clean_(body.comment,1500), "Added On": new Date(), "Added By": clean_(body.updatedBy,250)});
}

function updateBoy_(body) {
  const row = findRow_(TABS.boys,"Boy ID",body.boyId);
  const mentorId = required_(body.mentorId,"Mentor");
  findObject_(TABS.mentors,"Mentor ID",mentorId);
  const fields = {"Contact":clean_(body.contact,24),"Branch":clean_(body.branch,100),"Section":clean_(body.section,100),
    "College":clean_(body.college,150),"Hostel Name":clean_(body.hostel,150),"Status":allowed_(body.status,["Active","Passive","Dropped"],"Active"),
    "Mentor ID":mentorId,"Comment":clean_(body.comment,1500)};
  if (body.floor !== undefined) fields.Floor = floorField_(body, findObject_(TABS.boys,"Boy ID",body.boyId));
  if (body.name !== undefined) fields.Name = required_(body.name,"Boy name");
  updateObject_(TABS.boys,row,fields);
}

function deleteBoy_(body) {
  const value = required_(body.boyId,"Boy ID");
  const row = findRow_(TABS.boys,"Boy ID",value);
  // Validate both dependent tables before deleting any record.
  findRows_(TABS.attendance,{"Boy ID":value});
  findRows_(TABS.invitations,{"Boy ID":value});
  deleteMatches_(TABS.attendance,"Boy ID",value);
  deleteMatches_(TABS.invitations,"Boy ID",value);
  sheet_(TABS.boys).deleteRow(row);
}

function addProgram_(body) {
  const fields = programFields_(body);
  fields["Program ID"] = id_();
  appendObject_(TABS.programs,fields);
}

function updateProgram_(body) {
  const programId = required_(body.programId,"Program");
  const row = findRow_(TABS.programs,"Program ID",programId);
  const fields = programFields_(body);
  assertProgramTypeAttendanceUnique_(programId,fields["Program Type ID"]);
  updateObject_(TABS.programs,row,fields);
}

function deleteProgram_(body) {
  const value = required_(body.programId,"Program ID");
  const row = findRow_(TABS.programs,"Program ID",value);
  // Validate both dependent tables before deleting any record.
  findRows_(TABS.attendance,{"Program ID":value});
  findRows_(TABS.invitations,{"Program ID":value});
  deleteMatches_(TABS.attendance,"Program ID",value);
  deleteMatches_(TABS.invitations,"Program ID",value);
  sheet_(TABS.programs).deleteRow(row);
}

function setAttendance_(body) {
  const programId = required_(body.programId, "Program");
  const boyId = required_(body.boyId, "Boy");
  const status = allowed_(body.status, ["Present", "Absent", "Late"], "");
  if (!status) throw new Error("Select a valid attendance status.");
  if (status === "Absent" && !text_(body.reason)) throw new Error("Add the reason before marking absent.");
  findObject_(TABS.programs, "Program ID", programId);
  const boy = findObject_(TABS.boys, "Boy ID", boyId);
  if (status === "Present") assertNoDuplicatePresent_(programId, boyId);
  const existing = findRows_(TABS.attendance, { "Program ID": programId, "Boy ID": boyId });
  const values = {"Attendance ID": existing.length ? existing[0].object["Attendance ID"] : id_(), "Program ID":programId, "Mentor ID":text_(boy["Mentor ID"]), "Boy ID":boyId, "Status":status, "Reason":clean_(body.reason,300), "Updated On":new Date(), "Updated By":clean_(body.updatedBy,250)};
  if (existing.length) updateObject_(TABS.attendance,existing[0].row,values);
  else appendObject_(TABS.attendance,values);
  for (let index = existing.length - 1; index >= 1; index--) sheet_(TABS.attendance).deleteRow(existing[index].row);
}

function deleteAttendance_(body) {
  deleteCompound_(TABS.attendance, { "Program ID": required_(body.programId, "Program"), "Boy ID": required_(body.boyId, "Boy") });
}

function setInvitation_(body) {
  const programId = required_(body.programId, "Program");
  const boyId = required_(body.boyId, "Boy");
  if (body.invited === false) return deleteInvitation_(body);
  const response = required_(body.response, "Invitation response");
  findObject_(TABS.programs, "Program ID", programId);
  const boy = findObject_(TABS.boys, "Boy ID", boyId);
  const existing = findRows_(TABS.invitations, { "Program ID": programId, "Boy ID": boyId });
  const values = {"Invitation ID":existing.length ? existing[0].object["Invitation ID"] : id_(), "Program ID":programId,"Mentor ID":text_(boy["Mentor ID"]),"Boy ID":boyId,"Response":clean_(response,300),"Updated On":new Date(),"Updated By":clean_(body.updatedBy,250)};
  if (existing.length) updateObject_(TABS.invitations,existing[0].row,values);
  else appendObject_(TABS.invitations,values);
  for (let index = existing.length - 1; index >= 1; index--) sheet_(TABS.invitations).deleteRow(existing[index].row);
}

function deleteInvitation_(body) {
  deleteCompound_(TABS.invitations, { "Program ID": required_(body.programId, "Program"), "Boy ID": required_(body.boyId, "Boy") });
}

function updateWebsiteContent_(body) {
  if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) throw new Error("Website content values are required.");
  Object.keys(body.values).forEach(function(key) { findRow_(TABS.content,"Key",key); });
  Object.keys(body.values).forEach(function(key) {
    updateObject_(TABS.content,findRow_(TABS.content,"Key",key),{"Value":clean_(body.values[key],3000),"Updated On":new Date(),"Updated By":clean_(body.updatedBy,250)});
  });
}

function assertNoDuplicatePresent_(programId, boyId) {
  const programs = rows_(TABS.programs);
  const target = programs.find(function (row) { return text_(row["Program ID"]) === programId; });
  const typeId = target && text_(target["Program Type ID"]);
  if (!typeId) return;
  const sameTypeIds = programs.filter(function (row) { return text_(row["Program Type ID"]) === typeId; }).map(function (row) { return text_(row["Program ID"]); });
  const duplicate = rows_(TABS.attendance).some(function (row) {
    return text_(row["Boy ID"]) === boyId && text_(row.Status) === "Present" && text_(row["Program ID"]) !== programId && sameTypeIds.indexOf(text_(row["Program ID"])) >= 0;
  });
  if (duplicate) throw new Error("This boy is already marked Present for another dated session of the same Program Type.");
}

function assertProgramTypeAttendanceUnique_(programId, targetTypeId) {
  const presentBoyIds = rows_(TABS.attendance).filter(function (row) { return text_(row["Program ID"]) === programId && text_(row.Status) === "Present"; }).map(function (row) { return text_(row["Boy ID"]); });
  if (!presentBoyIds.length) return;
  const targetProgramIds = rows_(TABS.programs).filter(function (row) { return text_(row["Program Type ID"]) === targetTypeId && text_(row["Program ID"]) !== programId; }).map(function (row) { return text_(row["Program ID"]); });
  const conflict = rows_(TABS.attendance).some(function (row) { return text_(row.Status) === "Present" && presentBoyIds.indexOf(text_(row["Boy ID"])) >= 0 && targetProgramIds.indexOf(text_(row["Program ID"])) >= 0; });
  if (conflict) throw new Error("Changing this Program Type would create duplicate Present credit for one or more boys.");
}
function sheet_(name) {
  if (!requestSpreadsheet) requestSpreadsheet = SpreadsheetApp.openById(MENTORING_SPREADSHEET_ID);
  const sheet = requestSpreadsheet.getSheetByName(name);
  if (!sheet) throw new Error("Missing Sheet tab: " + name);
  return sheet;
}

function table_(name) {
  if (requestTables[name]) return requestTables[name];
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(function(value) { const key = text_(value); return ["Room No","Room No.","Room Number"].indexOf(key) >= 0 ? "Hostel Name" : key; }) : [];
  const objects = values.slice(1).filter(function (row) { return row.some(function (value) { return text_(value); }); }).map(function (row) {
    const object = {};
    headers.forEach(function (header, index) { object[header] = row[index]; });
    return object;
  });
  return requestTables[name] = { sheet: sheet, headers: headers, objects: objects, values: values };
}

function rows_(name) { return table_(name).objects; }

function keyValues_(name, keyHeader, valueHeader) {
  const result = {};
  rows_(name).forEach(function (row) { const key = text_(row[keyHeader]); if (key) result[key] = text_(row[valueHeader]); });
  return result;
}

function findObject_(name, header, value) {
  const normalized = required_(value, header);
  const found = rows_(name).find(function (row) { return text_(row[header]) === normalized; });
  if (!found) throw new Error(header + " was not found.");
  return found;
}

function findRow_(name, header, value) {
  const normalized = required_(value, header);
  const table = table_(name);
  const column = table.headers.indexOf(header);
  if (column < 0) throw new Error("Missing column: " + header);
  for (let index = 1; index < table.values.length; index++) if (text_(table.values[index][column]) === normalized) return index + 1;
  throw new Error(header + " was not found.");
}

function findRows_(name, match) {
  const table = table_(name);
  Object.keys(match).forEach(function(header) { if (table.headers.indexOf(header) < 0) throw new Error("Missing column: " + header); });
  return table.values.slice(1).map(function (values, index) {
    const object = {}; table.headers.forEach(function (header, column) { object[header] = values[column]; });
    return { row: index + 2, object: object };
  }).filter(function (item) { return Object.keys(match).every(function (header) { return text_(item.object[header]) === text_(match[header]); }); });
}

function deleteMatches_(name, header, value) { deleteCompound_(name, (function () { const match = {}; match[header] = value; return match; })()); }

function deleteCompound_(name, match) {
  const sheet = sheet_(name);
  findRows_(name, match).sort(function (a, b) { return b.row - a.row; }).forEach(function (item) { sheet.deleteRow(item.row); });
  delete requestTables[name];
}

function indexBy_(rows, key, value) { const result = {}; rows.forEach(function (row) { result[text_(row[key])] = text_(row[value]); }); return result; }
function output_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function text_(value) { return value === null || value === undefined ? "" : String(value).trim(); }
function clean_(value, limit) { return text_(value).slice(0, limit); }
function required_(value, label) { const result = text_(value); if (!result) throw new Error(label + " is required."); return result; }
function allowed_(value, choices, fallback) { const result = text_(value); return choices.indexOf(result) >= 0 ? result : fallback; }
function id_() { return Utilities.getUuid(); }
function initials_(value) { return text_(value).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join("") || "—"; }
function requiredDate_(value) {
  const date = text_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error("Select a valid date.");
  return date;
}

function isoDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const text = text_(value); const direct = text.match(/^\d{4}-\d{2}-\d{2}/); if (direct) return direct[0];
  const parsed = new Date(text); return isNaN(parsed.getTime()) ? "" : Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function isoTimestamp_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(value); return isNaN(parsed.getTime()) ? text_(value) : parsed.toISOString();
}
function safeEqual_(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0; for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function programFields_(body) {
  const typeId = required_(body.programTypeId,"Program Type");
  const type = findObject_(TABS.programTypes,"Program Type ID",typeId);
  return {"Program Name":clean_(body.name,180) || required_(type["Program Name"],"Program Type"),
    "Date":requiredDate_(body.date),"Venue":clean_(body.venue,200),"Speaker":clean_(body.speaker,180),"Program Type ID":typeId};
}
function columns_(table,fields) {
  return Object.keys(fields).map(function(header) {
    const column = table.headers.indexOf(header);
    if (column < 0 || table.headers.lastIndexOf(header) !== column) throw new Error("Missing or duplicate column: " + header);
    return {header:header,column:column};
  });
}
function literal_(value) { return typeof value === "string" && value.charAt(0) === "=" ? "'" + value : value; }
function appendObject_(name,fields) {
  const table = table_(name);
  const row = table.headers.map(function() { return ""; });
  columns_(table,fields).forEach(function(item) { row[item.column] = literal_(fields[item.header]); });
  table.sheet.appendRow(row);
  delete requestTables[name];
}
function updateObject_(name,row,fields) {
  const table = table_(name);
  const columns = columns_(table,fields).sort(function(a,b) { return a.column-b.column; });
  // Only touch requested fields; preserve totals, formulas and unrelated cells.
  // Batch adjacent changed cells without overwriting gaps or formula columns.
  const groups = [];
  columns.forEach(function(item) {
    const group = groups[groups.length-1];
    if (group && group[group.length-1].column+1 === item.column) group.push(item);
    else groups.push([item]);
  });
  groups.forEach(function(group) {
    table.sheet.getRange(row,group[0].column+1,1,group.length).setValues([group.map(function(item) { return literal_(fields[item.header]); })]);
  });
  delete requestTables[name];
}
function doGet() { return output_({ok:true,status:"healthy",backendVersion:"header-mapping-v1"}); }

// Floor is optional. Never guess it from an existing room number.
function floorField_(body, current) {
  const floor = text_(body.floor).toUpperCase();
  const room = text_(body.hostel);
  if (current && text_(body.floor) === text_(current.Floor) && room === text_(current["Hostel Name"])) return text_(current.Floor);
  if (floor && !/^B[0-9]$/.test(floor)) throw new Error("Select a floor from B0 to B9, or leave it unassigned.");
  if (floor && (!/^\d+$/.test(room) || Number(room) < 1 || Number(room) > 61)) throw new Error("Select a room from 1 to 61 for the assigned floor.");
  return floor;
}
