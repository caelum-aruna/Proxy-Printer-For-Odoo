// src/helpers/xml-renderer.js
// Parse dan render XML receipt Odoo POS ke perintah ESC/POS thermal printer

const sax = require("sax");
const config = require("../../config");
const { formatXmlValue } = require("./format");

function setPrinterAlign(printer, align) {
  if (align === "center") {
    printer.alignCenter();
  } else if (align === "right") {
    printer.alignRight();
  } else {
    printer.alignLeft();
  }
}

/**
 * Render XML receipt (format Odoo POS <receipt>) ke printer thermal via SAX streaming.
 * @param {object} printer  instance node-thermal-printer
 * @param {string} xmlString  XML receipt string
 * @returns {Promise<void>}
 */
async function renderXmlReceipt(printer, xmlString) {
  let cleanXml = xmlString.trim();
  const receiptStart = cleanXml.indexOf("<receipt");
  if (receiptStart !== -1) {
    cleanXml = cleanXml.substring(receiptStart);
  }
  const receiptEnd = cleanXml.lastIndexOf("</receipt>");
  if (receiptEnd !== -1) {
    cleanXml = cleanXml.substring(0, receiptEnd + 10);
  }

  return new Promise((resolve, reject) => {
    const parser = sax.parser(false, { lowercase: true, trim: false });

    const tagStack = [];
    let currentLine = null;
    let currentSection = null; // 'left' | 'right' | 'center'
    let currentAlign = "center";
    let blockBuffer = "";
    let isBold = false;
    let isDoubleHeight = false;

    let valueBuffer = '';
    let inValue = false;
    let valueAttrs = {};
    let receiptThousandsSep = '.';
    let receiptDecimalSep = ',';

    let receiptWidth = config.charsPerLine || 48;

    function flushBlockBuffer() {
      const clean = blockBuffer.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
      if (clean) {
        const isDivider = /^[-=_\.]{5,}$/.test(clean);
        if (isDivider) {
          printer.alignLeft();
          printer.println("-".repeat(receiptWidth));
          setPrinterAlign(printer, currentAlign);
        } else {
          printer.println(clean);
        }
      }
      blockBuffer = "";
    }

    parser.onerror = (err) => {
      console.warn("XML Receipt non-fatal parse warning:", err.message);
    };

    parser.onopentag = (node) => {
      const tag = node.name;
      const attrs = node.attributes || {};
      tagStack.push({ tag, attrs });

      if (tag === "receipt") {
        if (attrs['value-thousands-separator']) {
          receiptThousandsSep = attrs['value-thousands-separator'];
        }
        if (attrs['value-decimals-separator'] || attrs['value-decimal-separator']) {
          receiptDecimalSep = attrs['value-decimals-separator'] || attrs['value-decimal-separator'];
        }
        if (!config.charsPerLine && attrs.width) {
          const parsedWidth = parseInt(attrs.width, 10);
          if (!isNaN(parsedWidth) && parsedWidth > 0) {
            receiptWidth = parsedWidth;
          }
        }
        if (attrs.align) {
          currentAlign = attrs.align.toLowerCase();
          setPrinterAlign(printer, currentAlign);
        }
      } else if (tag === "value") {
        inValue = true;
        valueBuffer = '';
        valueAttrs = attrs;
      } else if (tag === "div" || tag === "p" || tag === "header" || tag === "footer") {
        flushBlockBuffer();
        if (attrs.align) {
          setPrinterAlign(printer, attrs.align.toLowerCase());
        }
        if (attrs.size === "double-height" || attrs.size === "double") {
          printer.setTextDoubleHeight();
          isDoubleHeight = true;
        }
      } else if (tag === "b" || tag === "strong" || tag.match(/^h[1-5]$/)) {
        printer.bold(true);
        isBold = true;
        if (tag === "h1" || tag === "h2" || attrs.size === "double") {
          printer.setTextDoubleWidth();
          printer.setTextDoubleHeight();
        } else if (tag === "h3" || tag === "h4" || attrs.size === "double-height") {
          printer.setTextDoubleHeight();
        }
      } else if (tag === "pre") {
        flushBlockBuffer();
        if (attrs.size === "double-height" || attrs.size === "double") {
          printer.setTextDoubleHeight();
          isDoubleHeight = true;
        }
        if (attrs.align) {
          setPrinterAlign(printer, attrs.align.toLowerCase());
        }
      } else if (tag === "line") {
        flushBlockBuffer();
        currentLine = {
          left: "",
          right: "",
          center: "",
          indent: parseInt(attrs.indent, 10) || 0,
          size: attrs.size || (attrs.class && attrs.class.includes("total") ? "double-height" : null),
          bold: attrs.bold === "on" || isBold,
        };
      } else if (tag === "left" && currentLine) {
        currentSection = "left";
      } else if (tag === "right" && currentLine) {
        currentSection = "right";
      } else if (tag === "center" && currentLine) {
        currentSection = "center";
      } else if (tag === "br") {
        flushBlockBuffer();
      } else if (tag === "hr") {
        flushBlockBuffer();
        printer.alignLeft();
        printer.println("-".repeat(receiptWidth));
        setPrinterAlign(printer, currentAlign);
      } else if (tag === "cut") {
        printer.cut();
      } else if (tag === "cashdraw") {
        printer.openCashDrawer();
      }
    };

    parser.ontext = (text) => {
      if (!text) return;

      if (inValue) {
        valueBuffer += text;
        return;
      }

      if (currentLine) {
        if (currentSection === "left") {
          currentLine.left += text;
        } else if (currentSection === "right") {
          currentLine.right += text;
        } else if (currentSection === "center") {
          currentLine.center += text;
        } else {
          currentLine.left += text;
        }
      } else {
        blockBuffer += text;
      }
    };

    parser.onclosetag = (tagName) => {
      tagStack.pop();

      if (tagName === "value") {
        inValue = false;
        const formatted = formatXmlValue(valueBuffer, valueAttrs, receiptThousandsSep, receiptDecimalSep);
        if (currentLine) {
          if (currentSection === "left") {
            currentLine.left += formatted;
          } else if (currentSection === "right") {
            currentLine.right += formatted;
          } else if (currentSection === "center") {
            currentLine.center += formatted;
          } else {
            currentLine.left += formatted;
          }
        } else {
          blockBuffer += formatted;
        }
        valueBuffer = '';
      } else if (tagName === "line") {
        if (currentLine) {
          const isDoubleWidth = currentLine.size === "double" || currentLine.size === "double-width";
          const isDblHeight = currentLine.size === "double-height" || currentLine.size === "double";
          const effectiveWidth = isDoubleWidth ? Math.floor(receiptWidth / 2) : receiptWidth;

          if (isDoubleWidth) {
            printer.setTextDoubleWidth();
          }
          if (isDblHeight) {
            printer.setTextDoubleHeight();
          }
          if (currentLine.bold) {
            printer.bold(true);
          }

          const left = currentLine.left.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
          const right = currentLine.right.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
          const center = currentLine.center.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
          const indentStr = currentLine.indent > 0 ? "  ".repeat(currentLine.indent) : "";

          printer.alignLeft();

          if (left && right) {
            const adjustedLeft = indentStr + left;
            if (adjustedLeft.length + right.length + 1 <= effectiveWidth) {
              const spaces = effectiveWidth - adjustedLeft.length - right.length;
              printer.println(adjustedLeft + " ".repeat(spaces) + right);
            } else {
              const maxLeft = effectiveWidth - right.length - 1;
              if (maxLeft >= 6) {
                printer.println(adjustedLeft.substring(0, maxLeft) + " " + right);
              } else {
                printer.println(adjustedLeft);
                printer.println(right.padStart(effectiveWidth, " "));
              }
            }
          } else if (left) {
            printer.println(indentStr + left);
          } else if (right) {
            printer.println(right.padStart(effectiveWidth, " "));
          } else if (center) {
            printer.alignCenter();
            printer.println(center);
          }

          if (currentLine.size || isDoubleHeight) {
            printer.setTextNormal();
            isDoubleHeight = false;
          }
          if (currentLine.bold && !isBold) {
            printer.bold(false);
          }

          setPrinterAlign(printer, currentAlign);
          currentLine = null;
          currentSection = null;
        }
      } else if (tagName === "left" || tagName === "right" || tagName === "center") {
        currentSection = null;
      } else if (tagName === "b" || tagName === "strong" || tagName.match(/^h[1-5]$/)) {
        printer.bold(false);
        isBold = false;
        printer.setTextNormal();
      } else if (tagName === "pre" || tagName === "div" || tagName === "p") {
        flushBlockBuffer();
        if (isDoubleHeight) {
          printer.setTextNormal();
          isDoubleHeight = false;
        }
        setPrinterAlign(printer, currentAlign);
      } else if (tagName === "receipt") {
        flushBlockBuffer();
        printer.cut();
      }
    };

    parser.onend = () => {
      resolve();
    };

    parser.write(cleanXml).close();
  });
}

module.exports = { renderXmlReceipt, setPrinterAlign };
