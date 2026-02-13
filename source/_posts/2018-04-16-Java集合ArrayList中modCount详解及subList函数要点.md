---
title: Java集合ArrayList中modCount详解及subList函数要点
comments: true
date: 2018-04-16 15:55:27
tags: 集合 ConcurrentModificationException
categories: 集合
---
因为一次在项目开发中使用ArrayList的过程中，发生了**ConcurrentModificationException**异常，于是查询了相关资料，对发生该异常的原因记录一下。

所谓的ConcurrentModificationException翻译过来就是并发修改异常，网上大部分该异常出现的原因，都是在使用迭代器的时候发生的，比如：

```
import java.util.ArrayList;
import java.util.Iterator;

public class Test {

    public static void main(String[] args) {
        ArrayList<String> array = new ArrayList<String>();

        // 创建并添加元素
        array.add("hello");
        array.add("world");
        array.add("java");
        Iterator it = array.iterator();
        while (it.hasNext()) {
            String s = (String) it.next();
            if ("world".equals(s)) {
                array.add("javaee");
            }
        }
    }
}
```
在该例子中，我们使用迭代器进行迭代的过程中对集合进行了操作（不限于此处的添加操作，也可能是删除等），导致迭代器失效抛出该异常。但是在项目当中，本人并没有使用到迭代器，而是存在下面一段代码：

```
List<TableEntity> tableEntities = tableData.getValue().subList(1, tableData.getValue().size());
List<TableEntity> newEntitys = tableData.getValue().subList(0,1);
List<TableEntity> entities = sortTableEntity(tableEntities);
newEntitys.addAll(entities);
tableData.getValue().clear();
tableData.getValue().addAll(newEntitys);
```
异常在最后一步的时候抛出。可见，ConcurrentModificationException异常不仅仅是在使用迭代器的时候会出现。分析ArrayList类的subList源码我们可以发现，

```java
public List<E> subList(int fromIndex, int toIndex) {
    subListRangeCheck(fromIndex, toIndex, size);
    return new SubList(this, 0, fromIndex, toIndex);
}
```
此处返回了一个SubList的对象，而在其构造函数内部，

```
SubList(AbstractList<E> parent,int offset, int fromIndex, int toIndex) {
	this.parent = parent;
	this.parentOffset = fromIndex;
	this.offset = offset + fromIndex;
	this.size = toIndex - fromIndex;
	this.modCount = ArrayList.this.modCount;
}
```
可以看到**this.modCount = ArrayList.this.modCount**这样一句代码。而在第一个迭代器的例子中，通过iterator()函数返回的迭代器在构造当中也使用到了

```java
private class Itr implements Iterator<E> {
        int cursor;       // index of next element to return
        int lastRet = -1; // index of last element returned; -1 if no such
        int expectedModCount = modCount;

        public boolean hasNext() {
            return cursor != size;
        }

        @SuppressWarnings("unchecked")
        public E next() {
            checkForComodification();
            int i = cursor;
            if (i >= size)
                throw new NoSuchElementException();
            Object[] elementData = ArrayList.this.elementData;
            if (i >= elementData.length)
                throw new ConcurrentModificationException();
            cursor = i + 1;
            return (E) elementData[lastRet = i];
        }

        public void remove() {
            if (lastRet < 0)
                throw new IllegalStateException();
            checkForComodification();

            try {
                ArrayList.this.remove(lastRet);
                cursor = lastRet;
                lastRet = -1;
                expectedModCount = modCount;
            } catch (IndexOutOfBoundsException ex) {
                throw new ConcurrentModificationException();
            }
        }

        @Override
        @SuppressWarnings("unchecked")
        public void forEachRemaining(Consumer<? super E> consumer) {
            Objects.requireNonNull(consumer);
            final int size = ArrayList.this.size;
            int i = cursor;
            if (i >= size) {
                return;
            }
            final Object[] elementData = ArrayList.this.elementData;
            if (i >= elementData.length) {
                throw new ConcurrentModificationException();
            }
            while (i != size && modCount == expectedModCount) {
                consumer.accept((E) elementData[i++]);
            }
            // update once at end of iteration to reduce heap write traffic
            cursor = i;
            lastRet = i - 1;
            checkForComodification();
        }

        final void checkForComodification() {
            if (modCount != expectedModCount)
                throw new ConcurrentModificationException();
        }
    }
```
可见，该异常的抛出与modCount有关,modCount属性是从AbstractList抽象类继承而来的。查看javadoc文档中的解释:
>The number of times this list has been structurally modified. Structural modifications are those that change the size of the list, or otherwise perturb it in such a fashion that iterations in progress may yield incorrect results.
This field is used by the iterator and list iterator implementation returned by the iterator and listIterator methods. If the value of this field changes unexpectedly, the iterator (or list iterator) will throw a ConcurrentModificationException in response to the next, remove, previous, set or add operations. This provides fail-fast behavior, rather than non-deterministic behavior in the face of concurrent modification during iteration.

我们知道该参数用来记录集合被修改的次数，之所以要记录修改的次数，是因为ArrayList不是线程安全的，为了防止在使用迭代器和子序列的过程当中对原集合的修改导致迭代器及子序列的失效，故保存了修改次数的记录，在迭代器的操作及子序列的操作过程当中，会首先去检查modCount是否相等（函数checkForComodification()），如果不想等的话，则说明集合被修改了，那么为了防止后续不明确的错误发生，于是便抛出了该异常。为了防止该异常的出现，在使用迭代器进行集合的迭代是，若要对集合进行修改，需要通过迭代器提供的对集合进行操作的函数来进行。而对我代码中出现的问题，可以修改为：

```
List<TableEntity> tableEntities = Lists.newArrayList(tableData.getValue().subList(1, tableData.getValue().size()));
List<TableEntity> newEntitys = Lists.newArrayList(tableData.getValue().subList(0,1));
List<TableEntity> entities = sortTableEntity(tableEntities);
newEntitys.addAll(entities);
tableData.getValue().clear();
tableData.getValue().addAll(newEntitys);
```
这样的话，newEntitys就是一个ArrayList的对象而不是SubList的对象了。该情况也是第一次遇到，网上其他解释基本上都是第一种情况（即使用迭代器）发生。其实无论是第一种情况还是第二种情况，本质都是因为原集合的modCount被修改，导致与SubList的modCount或者是迭代器的expectedModCount不同导致的。


欢迎关注个人公众号：
![个人公号](/images/个人公号.jpg)