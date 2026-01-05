# Documentation Index

All project documentation organized by topic.

## 📋 Core Documentation

### Requirements & Standards
- **[CODE_STANDARDS.md](CODE_STANDARDS.md)** - Code naming, structure, error handling, security
- **[TESTING.md](TESTING.md)** - Testing requirements, templates, coverage expectations
- **[RULES.md](../RULES.md)** - Master reference (quick summary)

### Architecture & Design
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design, components, data flow, design decisions

### Operations & Support
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions

---

## 🎯 Quick Navigation

### I want to...

- **...write code** → [CODE_STANDARDS.md](CODE_STANDARDS.md)
- **...write tests** → [TESTING.md](TESTING.md)
- **...understand the system** → [ARCHITECTURE.md](ARCHITECTURE.md)
- **...fix a problem** → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **...find a rule** → [RULES.md](../RULES.md)

---

## 📚 By Topic

### Naming Conventions
See [CODE_STANDARDS.md](CODE_STANDARDS.md#naming-conventions)

### Code Structure
See [CODE_STANDARDS.md](CODE_STANDARDS.md#code-structure)

### Error Handling
See [CODE_STANDARDS.md](CODE_STANDARDS.md#error-handling)

### Testing
See [TESTING.md](TESTING.md)

### Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md)

### Troubleshooting
See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 📖 Reading Order

1. **Start here**: [RULES.md](../RULES.md) - Quick overview
2. **For coding**: [CODE_STANDARDS.md](CODE_STANDARDS.md) - Implementation guidelines
3. **For testing**: [TESTING.md](TESTING.md) - Test requirements
4. **For design**: [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
5. **For issues**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problem solving

---

## ⚡ Quick Reference

### Golden Rules
1. Tests go in `tests/` (mirrors `src/`)
2. Docs go in `docs/`
3. Source code goes in `src/`
4. Follow naming conventions
5. Log errors, then throw
6. No hardcoded secrets
7. JSDoc for all public functions

### JavaScript
- Files: kebab-case
- Variables: camelCase
- Constants: UPPER_SNAKE_CASE

### Python
- Files: snake_case
- Variables: snake_case
- Classes: PascalCase

### Git
- Branches: feature/*, fix/*, refactor/*, test/*, docs/*
- Commits: `<type>: <subject>` (feat, fix, refactor, test, docs, chore)

---

## 📂 File Structure

```
docs/
├── README.md                ← This file
├── CODE_STANDARDS.md        ← Code naming, structure, patterns
├── TESTING.md               ← Testing requirements & templates
├── ARCHITECTURE.md          ← System design
└── TROUBLESHOOTING.md       ← Common issues

root/
├── RULES.md                 ← Master reference
├── README.md                ← Project overview
└── package.json             ← Dependencies
```
