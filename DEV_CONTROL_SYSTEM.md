
# ChirpBot Development Control System

## 🚨 **DEV MODE Protocol**

### When to Enter DEV MODE
- Isolating specific bugs
- Testing single component changes
- Preventing cascade failures
- System debugging

### DEV MODE Rules
1. **LOCK DOWN**: No changes outside target scope
2. **SINGLE FOCUS**: One issue at a time
3. **ROLLBACK READY**: Keep working state backup
4. **TEST ISOLATION**: Disable non-essential systems

## 🔧 **Issue Isolation Checklist**

### Before Making ANY Changes
- [ ] Identify exact error location
- [ ] Check console logs for root cause
- [ ] Verify related systems are stable
- [ ] Create checkpoint/backup

### Change Validation
- [ ] Does this fix ONLY the target issue?
- [ ] Will this affect other systems?
- [ ] Is this the minimal viable fix?
- [ ] Can we test this in isolation?

## 🎯 **Current Issue Categories**

### 1. **WebSocket Issues** (CRITICAL)
- Vite development server port configuration
- `localhost:undefined` connection errors
- Multiple connection attempts

### 2. **TypeScript Issues** (HIGH)
- Method parameter mismatches
- Type definition inconsistencies
- Build compilation errors

### 3. **Alert System Issues** (MEDIUM)
- Wind change module bugs
- Duplicate alert handling
- Database storage consistency

## 🛠 **Systematic Debugging Approach**

### Phase 1: IDENTIFY
1. **Read error logs completely**
2. **Trace error to source file**
3. **Understand the intended behavior**
4. **Check related dependencies**

### Phase 2: ISOLATE
1. **Disable other alert modules**
2. **Test with minimal data**
3. **Use console.log strategically**
4. **Verify database state**

### Phase 3: FIX
1. **Make minimal targeted change**
2. **Test immediately**
3. **Verify no side effects**
4. **Update related documentation**

### Phase 4: VALIDATE
1. **Run full system test**
2. **Check all logs for new errors**
3. **Verify related functionality**
4. **Document the fix**

## 🔒 **DEV MODE Commands**

### Enter DEV Mode
```bash
# Stop all non-essential services
npm run dev-mode-start

# Enable debug logging
export DEBUG_MODE=true
export LOG_LEVEL=debug
```

### Exit DEV Mode
```bash
# Resume normal operations
npm run dev-mode-end
export DEBUG_MODE=false
```

## 📊 **Error Tracking Matrix**

| Component | Last Issue | Status | Next Check |
|-----------|------------|--------|------------|
| Vite WebSocket | Port undefined | ACTIVE | Immediate |
| MLB Wind Module | Parameter mismatch | FIXED | Monitor |
| Alert Deduplication | Working | STABLE | Weekly |
| Database Storage | Working | STABLE | Weekly |

## 🚫 **Forbidden During DEV MODE**
- Adding new features
- Refactoring working code
- Changing multiple files simultaneously
- Updating dependencies
- Design/UI changes

## ✅ **Allowed During DEV MODE**
- Bug fixes only
- Console logging for debugging
- Configuration adjustments
- Documentation updates
- Test improvements

## 🎯 **Current Priority Queue**
1. Fix Vite WebSocket port configuration
2. Resolve remaining MLB wind change issues
3. Monitor alert system stability
4. Document all fixes

## 📝 **Change Log Template**
```
## Change: [Brief Description]
**Date**: [Date]
**Issue**: [What was broken]
**Root Cause**: [Why it was broken]
**Fix**: [What was changed]
**Testing**: [How it was verified]
**Side Effects**: [Any other impacts]
```

This system will help you maintain control and prevent creating new problems while fixing existing ones.
